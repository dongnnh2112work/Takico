// takico-server — static file server nhúng sẵn, không cần Python trên máy khách
package main

import (
	"fmt"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"
)

func main() {
	port := 8765
	if p := os.Getenv("TAKICO_PORT"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 0 && n < 65536 {
			port = n
		}
	}

	root, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}

	_ = mime.AddExtensionType(".webp", "image/webp")
	_ = mime.AddExtensionType(".wasm", "application/wasm")
	_ = mime.AddExtensionType(".jsx", "text/javascript")
	_ = mime.AddExtensionType(".glb", "model/gltf-binary")

	addr := fmt.Sprintf("127.0.0.1:%d", port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatal(err)
	}

	fs := http.FileServer(http.Dir(root))
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		fs.ServeHTTP(w, r)
	})

	srv := &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Printf("takico-server %s -> %s", addr, root)
	log.Fatal(srv.Serve(ln))
}
