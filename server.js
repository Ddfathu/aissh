const net = require('net');
const crypto = require('crypto');

const LISTEN_PORT = parseInt(process.env.PORT || "8080");
const SSL_TARGET_HOST = process.env.SSL_TARGET_HOST || "127.0.0.1";
const SSL_TARGET_PORT = parseInt(process.env.SSL_TARGET_PORT || "2443");
const SSH_TARGET_PORT = parseInt(process.env.WS_TARGET_PORT || "22");

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const DEFAULT_RESPONSE = "HTTP/1.1 101 Switching Protocols\r\n\r\n";
const TLS_HANDSHAKE_BYTE = 0x16;
const BUFFER_SIZE = 256 * 1024; 

console.log(`[monster-mux] ALL-IN-ONE FIXED KEX v7.3 ACTIVE on Port: ${LISTEN_PORT} 🚀`);

function parseHeaders(rawBuffer) {
    const headers = {};
    try {
        const lines = rawBuffer.toString('utf8').split("\r\n");
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes(":")) {
                const parts = line.split(":");
                headers[parts[0].trim().toLowerCase()] = parts.slice(1).join(":").trim();
            }
        }
    } catch (e) {}
    return headers;
}

const server = net.createServer({
    readableHighWaterMark: BUFFER_SIZE,
    writableHighWaterMark: BUFFER_SIZE
}, (clientConn) => {
    clientConn.setNoDelay(true);
    clientConn.setKeepAlive(true, 15000); 

    let targetConn = null;
    let isWsJalur = false;
    let firstPacketRead = false;
    let pipeActivated = false; // 🔥 Ubah penanda menjadi aktivasi pipe
    
    let queueBuffers = []; 
    let backendReady = false;

    const destroyAll = () => {
        clientConn.destroy();
        if (targetConn) targetConn.destroy();
    };

    const startPiping = () => {
        if (pipeActivated) return;
        pipeActivated = true;
        
        // Lepas pasang secara bersih ke native pipe tanpa double write
        clientConn.unpipe(targetConn);
        targetConn.unpipe(clientConn);
        
        clientConn.pipe(targetConn);
        targetConn.pipe(clientConn);
    };

    clientConn.on('data', (chunk) => {
        // Jika pipe sudah aktif, biarkan pipe bekerja (kasus upload speedtest)
        if (pipeActivated && targetConn && targetConn.writable) {
            if (!targetConn.write(chunk)) clientConn.pause();
            return;
        }

        if (!firstPacketRead) {
            firstPacketRead = true;
            
            if (chunk[0] === TLS_HANDSHAKE_BYTE) {
                isWsJalur = false;
                targetConn = net.connect({ 
                    host: SSL_TARGET_HOST, 
                    port: SSL_TARGET_PORT,
                    readableHighWaterMark: BUFFER_SIZE,
                    writableHighWaterMark: BUFFER_SIZE
                }, () => {
                    targetConn.setNoDelay(true);
                    targetConn.setKeepAlive(true, 15000);
                    targetConn.write(chunk);
                    backendReady = true;
                    startPiping(); // Jalur SSL langsung pakai pipe
                });
            } else {
                isWsJalur = true;
                const headers = parseHeaders(chunk);
                const rawTextLower = chunk.toString('utf8').toLowerCase();
                const isWsUpgrade = rawTextLower.includes("upgrade: websocket") || headers["upgrade"] === "websocket";

                if (isWsUpgrade) {
                    let wsKey = headers["sec-websocket-key"];
                    if (!wsKey && rawTextLower.includes("sec-websocket-key:")) {
                        try {
                            const lines = chunk.toString('utf8').split("\r\n");
                            for (let line of lines) {
                                if (line.toLowerCase().includes("sec-websocket-key")) {
                                    wsKey = line.split(":")[1].trim();
                                    break;
                                }
                            }
                        } catch (e) {}
                    }
                    if (!wsKey) wsKey = crypto.randomBytes(16).toString('base64');
                    const shasum = crypto.createHash('sha1');
                    shasum.update(wsKey + WS_MAGIC);
                    const acceptKey = shasum.digest('base64');

                    let response = "HTTP/1.1 101 Switching Protocols\r\n" +
                                   "Upgrade: websocket\r\n" +
                                   "Connection: Upgrade\r\n" +
                                   `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`;
                    clientConn.write(Buffer.from(response));
                } else {
                    clientConn.write(Buffer.from(DEFAULT_RESPONSE));
                }

                targetConn = net.connect({ 
                    host: "127.0.0.1", 
                    port: SSH_TARGET_PORT,
                    readableHighWaterMark: BUFFER_SIZE,
                    writableHighWaterMark: BUFFER_SIZE
                }, () => {
                    targetConn.setNoDelay(true);
                    targetConn.setKeepAlive(true, 15000);
                    backendReady = true;
                    
                    if (queueBuffers.length > 0) {
                        for (let qChunk of queueBuffers) {
                            if (targetConn.writable) targetConn.write(qChunk);
                        }
                        queueBuffers = [];
                    }
                });
            }

            targetConn.on('data', (bChunk) => {
                if (pipeActivated) {
                    if (!clientConn.write(bChunk)) targetConn.pause();
                    return;
                }
                if (clientConn.writable) clientConn.write(bChunk);
            });

            targetConn.on('drain', () => { clientConn.resume(); });
            clientConn.on('drain', () => { targetConn.resume(); });
            targetConn.on('error', destroyAll);
            targetConn.on('close', destroyAll);
            return;
        }

        // Jalur Pembersihan data awal WebSocket SSH
        if (isWsJalur && !pipeActivated) {
            let cleanChunk = chunk;
            const chunkStr = chunk.toString('utf8');

            if (chunkStr.includes("PATCH") || chunkStr.includes("HTTP/") || chunkStr.includes("BMOVE") || chunkStr.includes("GET ")) {
                if (chunkStr.includes("SSH-")) {
                    cleanChunk = chunk.slice(chunkStr.indexOf("SSH-"));
                } else if (chunkStr.includes("\x53\x53\x48")) {
                    cleanChunk = chunk.slice(chunk.indexOf(Buffer.from([0x53, 0x53, 0x48])));
                } else {
                    return; // Ampas HTTP murni dibakar
                }
            }

            if (backendReady && targetConn.writable) {
                targetConn.write(cleanChunk);
            } else {
                queueBuffers.push(cleanChunk);
            }

            // PENTING: Jangan langsung aktifkan pipe di paket ini.
            // Biarkan paket data murni setelah banner SSH masuk di putaran berikutnya baru di-pipe.
            if (chunkStr.includes("SSH-") || chunk.includes(Buffer.from([0x53, 0x53, 0x48]))) {
                setTimeout(() => { startPiping(); }, 50); // Delay 50ms agar KEX handshake awal selesai aman
            }
        } else {
            if (backendReady && targetConn.writable) targetConn.write(chunk);
            else queueBuffers.push(chunk);
        }
    });

    clientConn.on('error', destroyAll);
    clientConn.on('close', destroyAll);
});

server.listen(LISTEN_PORT, '0.0.0.0');
