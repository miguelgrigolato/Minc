"""Servidor SÓ PARA TESTE LOCAL do seletor "Demo / Pior caso" (tests/pior-caso).
Serve a pasta minc-peritagem/ e força o modo local (sem nuvem) trocando /public/config.js por uma configuração vazia,
para que os dados de teste nunca cheguem ao Supabase. Nada daqui vai para o Netlify (que publica só public/).
Uso:  python3 tests/pior-caso/servir.py   →  abra http://localhost:8790/tests/pior-caso/
"""
import http.server, os, socketserver, sys
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 8790

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RAIZ, **k)
    def do_GET(self):
        if self.path.split('?')[0] == '/public/config.js':
            corpo = b'window.MINC_CONFIG={};/* modo local forcado pelo servidor de teste */'
            self.send_response(200); self.send_header('Content-Type', 'application/javascript')
            self.send_header('Content-Length', str(len(corpo))); self.end_headers(); self.wfile.write(corpo); return
        if self.path.split('?')[0] == '/public/service-worker.js':
            self.send_error(404); return   # sem cache do service worker durante o teste
        return super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORTA), H) as s:
    print(f'Seletor de dados: http://localhost:{PORTA}/tests/pior-caso/')
    s.serve_forever()
