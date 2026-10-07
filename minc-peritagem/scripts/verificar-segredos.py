#!/usr/bin/env python3
"""Falha (código 1) se a pasta public/ contiver uma chave SECRETA do Supabase.
Rode antes de cada publicação:  python3 scripts/verificar-segredos.py
Procura (1) JWTs cujo papel (role) seja service_role e (2) chaves no formato sb_secret_.
Chaves públicas (anon / sb_publishable_) são aceitas por desenho: a proteção está nas regras RLS do banco."""
import base64, json, os, re, sys
raiz = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
jwt = re.compile(r'eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}')
secret = re.compile(r'sb_secret_[A-Za-z0-9_-]{8,}')
problemas, publicas = [], 0
for pasta, _, arquivos in os.walk(raiz):
    for nome in arquivos:
        if not nome.endswith(('.js', '.html', '.json', '.css', '.txt', '.md', '.toml', '_headers')) and nome != '_headers':
            continue
        caminho = os.path.join(pasta, nome)
        txt = open(caminho, encoding='utf-8', errors='ignore').read()
        for m in jwt.finditer(txt):
            try:
                payload = json.loads(base64.urlsafe_b64decode(m.group(1) + '=' * (-len(m.group(1)) % 4)))
            except Exception:
                continue
            papel = payload.get('role')
            if papel == 'service_role': problemas.append((caminho, 'JWT com papel service_role'))
            elif papel == 'anon': publicas += 1
        if secret.search(txt): problemas.append((caminho, 'chave sb_secret_'))
if problemas:
    print('BLOQUEADO: chave secreta encontrada no site:')
    for c, p in problemas: print(' -', os.path.relpath(c, raiz), '->', p)
    sys.exit(1)
print(f'OK: nenhuma chave secreta em public/ (chaves públicas anon encontradas: {publicas}).')
