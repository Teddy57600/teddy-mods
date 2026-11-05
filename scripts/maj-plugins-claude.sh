#!/usr/bin/env bash
# Met à jour les marketplaces et tous les plugins Claude Code installés sur
# cette machine (session SSH de l'application desktop incluse).
#
# Usage : maj-plugins-claude.sh [-n|--simulation]
#   -n, --simulation  affiche ce qui serait mis à jour, sans rien installer
#
# Une mise à jour ne s'applique qu'aux sessions qui démarrent : le script liste
# à la fin les processus de session en cours, sans les arrêter.
set -euo pipefail

simulation=0
case "${1:-}" in
  -n|--simulation) simulation=1 ;;
  -h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  "") ;;
  *) echo "Option inconnue : $1 (voir --help)" >&2; exit 2 ;;
esac

# CLI : `claude` du PATH, sinon la plus récente déposée par l'application.
if command -v claude >/dev/null 2>&1; then
  CLI=$(command -v claude)
else
  CLI=$(ls -d "$HOME"/.claude/remote/ccd-cli/* 2>/dev/null | sort -V | tail -1 || true)
fi
if [[ -z "${CLI:-}" || ! -x "$CLI" ]]; then
  echo "CLI Claude Code introuvable (ni 'claude' dans le PATH, ni ~/.claude/remote/ccd-cli/)." >&2
  exit 1
fi
export GIT_TERMINAL_PROMPT=0
echo "CLI : $CLI"

versions() {  # « id version » de chaque plugin installé
  "$CLI" plugin list --json 2>/dev/null | python3 -c '
import json, sys
for p in json.load(sys.stdin):
    print(p["id"], p.get("version", "?"))'
}

avant=$(versions)
if [[ -z "$avant" ]]; then
  echo "Aucun plugin installé : rien à mettre à jour."
  exit 0
fi

echo
echo "== Marketplaces"
"$CLI" plugin marketplace update 2>&1 | grep -E '✔|✘|rror|chec' || true

echo
echo "== Plugins"
if (( simulation )); then
  # Version proposée = plugin.json du plugin dans la copie locale de sa marketplace.
  while read -r id v; do
    dispo=$(python3 - "$id" "$HOME/.claude/plugins/marketplaces" <<'PY' 2>/dev/null || echo "?"
import json, os, sys
nom, mkt = sys.argv[1].split("@", 1)
racine = os.path.join(sys.argv[2], mkt)
for p in json.load(open(os.path.join(racine, ".claude-plugin", "marketplace.json")))["plugins"]:
    if p["name"] == nom:
        src = p.get("source")
        if p.get("version"):
            print(p["version"]); break
        if isinstance(src, str):
            print(json.load(open(os.path.join(racine, src, ".claude-plugin", "plugin.json"))).get("version", "?")); break
        print("?"); break
else:
    print("?")
PY
)
    if [[ "$dispo" == "$v" ]]; then etat="à jour"; elif [[ "$dispo" == "?" ]]; then etat="inconnu"; else etat="mise à jour disponible"; fi
    echo "  $id : installé $v, proposé $dispo ($etat)"
  done <<<"$avant"
  echo
  echo "Simulation : aucun plugin n'a été modifié (les marketplaces ont été rafraîchies)."
  exit 0
fi

echecs=0
while read -r id _; do
  if sortie=$("$CLI" plugin update "$id" 2>&1); then
    echo "  $(grep -E '✔|already|à jour' <<<"$sortie" | tail -1 || echo "$id : terminé")"
  else
    echecs=$((echecs + 1))
    echo "  ✘ $id : $(tail -1 <<<"$sortie")"
  fi
done <<<"$avant"

apres=$(versions)
echo
echo "== Bilan"
changes=0
while read -r id v; do
  ancien=$(awk -v i="$id" '$1 == i { print $2 }' <<<"$avant")
  if [[ "$ancien" != "$v" ]]; then
    echo "  $id : $ancien → $v"
    changes=$((changes + 1))
  fi
done <<<"$apres"
(( changes )) || echo "  Tous les plugins étaient déjà à jour."

if (( changes )); then
  echo
  echo "Les nouvelles sessions utilisent les nouvelles versions."
  echo "Les sessions déjà ouvertes gardent l'ancienne jusqu'à la relance de leur processus :"
  pgrep -f '/ccd-cli/' 2>/dev/null | while read -r pid; do
    echo "  PID $pid, démarré le $(ps -o lstart= -p "$pid")"
  done || true
  echo "Pour relancer une session INACTIVE : kill -TERM <PID>, puis rouvrez-la et envoyez un message."
fi

(( echecs == 0 )) || { echo; echo "$echecs mise(s) à jour en échec." >&2; exit 1; }
