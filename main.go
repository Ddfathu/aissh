package main

import (
	"crypto/rand"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"log"
	"math/big"
	"net"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	WS_MAGIC           = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
	TLS_HANDSHAKE_BYTE = 0x16
)

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// 🎰 MODE SABAR GENERATOR (Secure Random Jitter 1-4ms)
func secureRandom(max int64) int64 {
	nBig, err := rand.Int(rand.Reader, big.NewInt(max))
	if err != nil {
		return 0
	}
	return nBig.Int64()
}

// 🏎️ FEATURE HIGH SPEED MAX: Pelebaran Buffer TCP Tingkat Tinggi
func turboTune(c net.Conn) {
	if tcp, ok := c.(*net.TCPConn); ok {
		_ = tcp.SetNoDelay(true)
		_ = tcp.SetKeepAlive(true)
		_ = tcp.SetKeepAlivePeriod(15 * time.Second)
		
		// Buffer diperlebar ke 256KB agar lalu lintas data download loss tanpa ngerem di OS
		_ = tcp.SetReadBuffer(262144)  
		_ = tcp.SetWriteBuffer(262144) 
	}
}

func main() {
	listenPort := getEnv("PORT", "8080")
	sslTargetHost := getEnv("SSL_TARGET_HOST", "127.0.0.1")
	sslTargetPort := getEnv("SSL_TARGET_PORT", "2443")
	wsTargetHost := getEnv("WS_TARGET_HOST", "127.0.0.1")
	wsTargetPort := getEnv("WS_TARGET_PORT", "22")

	log.Println("==================================================================")
	log.Println("🚀 GOLANG TUNNEL PRO: v7.0 MODE SABAR + HIGH SPEED MAX ACTIVE 🔥")
	log.Println("==================================================================")

	listener, err := net.Listen("tcp", ":"+listenPort)
	if err != nil {
		log.Fatalf("[-] Listener gagal: %v", err)
	}
	defer listener.Close()

	for {
		conn, err := listener.Accept()
		if err != nil {
			continue
		}
		go handleUltimateStream(conn, sslTargetHost, sslTargetPort, wsTargetHost, wsTargetPort)
	}
}

func handleUltimateStream(c net.Conn, sslHost, sslPort, wsHost, wsPort string) {
	turboTune(c) 
	defer c.Close()

	buf := make([]byte, 131072)
	c.SetReadDeadline(time.Now().Add(4 * time.Second))
	n, err := c.Read(buf)
	if err != nil || n == 0 {
		return
	}
	c.SetReadDeadline(time.Time{})
	rawPayload := buf[:n]

	// 🛡️ JALUR SSL DETECTION
	if rawPayload[0] == TLS_HANDSHAKE_BYTE {
		target, err := net.DialTimeout("tcp", sslHost+":"+sslPort, 4*time.Second)
		if err != nil {
			return
		}
		turboTune(target)
		defer target.Close()
		_, _ = target.Write(rawPayload)
		pipeData(c, target, false)
		return
	}

	// 🌐 JALUR WEBSOCKET + ARGO TUNNEL
	reqStr := string(rawPayload)
	wsKey := ""
	for _, line := range strings.Split(reqStr, "\r\n") {
		if strings.Contains(strings.ToLower(line), "sec-websocket-key") {
			if parts := strings.Split(line, ":"); len(parts) > 1 {
				wsKey = strings.TrimSpace(parts[1])
				break
			}
		}
	}

	if wsKey == "" {
		wsKey = base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%d", time.Now().UnixNano())))
	}

	h := sha1.New()
	h.Write([]byte(wsKey + WS_MAGIC))
	acceptKey := base64.StdEncoding.EncodeToString(h.Sum(nil))

	response := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Accept: " + acceptKey + "\r\n\r\n"
	_, err = c.Write([]byte(response))
	if err != nil {
		return
	}

	// Hubungkan ke Dropbear Lokal Ubuntu Lu
	sshTarget, err := net.DialTimeout("tcp", wsHost+":"+wsPort, 4*time.Second)
	if err != nil {
		return
	}
	turboTune(sshTarget)
	defer sshTarget.Close()

	// Tembakkan paket awal payload kotor ke Dropbear agar dibaca perlahan
	_, _ = sshTarget.Write(rawPayload)

	pipeData(c, sshTarget, true)
}

func pipeData(client, target net.Conn, isWS bool) {
	var once sync.Once
	closeAll := func() {
		_ = client.Close()
		_ = target.Close()
	}

	var wg sync.WaitGroup
	wg.Add(2)

	// Jalur A: HP -> Dropbear (✨ MENGGUNAKAN MODE SABAR ANTI-STUCK)
	go func() {
		defer wg.Done()
		buf := make([]byte, 65536)
		for {
			client.SetReadDeadline(time.Now().Add(120 * time.Second))
			n, err := client.Read(buf)
			if err != nil {
				break
			}
			
			// Tahan paket upload 1-4ms agar trik [split] payload lu mengalir berirama ke Dropbear
			if isWS {
				jitter := secureRandom(4) + 1
				time.Sleep(time.Duration(jitter) * time.Millisecond)
			}

			_, err = target.Write(buf[:n])
			if err != nil {
				break
			}
		}
		once.Do(closeAll)
	}()

	// Jalur B: Dropbear -> HP (🏎️ HIGH SPEED DOWNLOAD MAX - BYPASS TOTAL)
	go func() {
		defer wg.Done()
		buf := make([]byte, 65536)
		for {
			target.SetReadDeadline(time.Now().Add(25 * time.Second))
			n, err := target.Read(buf)
			if err != nil {
				if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
					if isWS {
						// Heartbeat/Ping aman agar koneksi gak idle saat sepi
						_, err = client.Write([]byte{0x89, 0x00})
						if err != nil {
							break
						}
						continue
					}
				}
				break
			}
			
			// Pipa download dilepas murni tanpa rem/sleep apa pun untuk meraih speed loss mentok kanan!
			if n > 0 {
				_, err = client.Write(buf[:n])
				if err != nil {
					break
				}
			}
		}
		once.Do(closeAll)
	}()

	wg.Wait()
}
