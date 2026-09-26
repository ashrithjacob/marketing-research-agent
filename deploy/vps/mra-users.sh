#!/usr/bin/env bash
# Manage marketing.vanis.ai logins and workspaces. Run it ON THE VPS, with -t:
#
#   ssh -t owui bash ~/mra-compose/mra-users.sh list
#   ssh -t owui bash ~/mra-compose/mra-users.sh add-workspace acme
#   ssh -t owui bash ~/mra-compose/mra-users.sh add-user alice acme
#   ssh -t owui bash ~/mra-compose/mra-users.sh reset-password alice
#   ssh -t owui bash ~/mra-compose/mra-users.sh disable alice
#
# Everyone in a workspace sees that workspace's runs; the admin sees all of
# them. Passwords are typed at a hidden prompt inside the running container, so
# they never reach shell history, `ps`, or a chat transcript; only the scrypt
# hash is stored, in research.db. A password reset or a disable signs that user
# out everywhere at once. Nothing restarts, so no research run is interrupted.
set -euo pipefail
exec docker exec -it mra node dist/accounts.js "$@"
