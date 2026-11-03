# teddy-mods

Deux mods Claude Code qui ajoutent une bande au-dessus de la zone de prompt :

- **context-weather** : la « météo » du contexte, c'est-à-dire le remplissage de la fenêtre de contexte (de Grand soleil à Orage).
- **usage-limits** : les limites d'usage sur 5 heures et sur 7 jours, avec leur heure de réinitialisation.

Sur l'application desktop, chaque bande est une carte graphique. Dans le terminal, c'est une ligne de texte. Les mods ne dépendent pas du compte : `usage-limits` affiche les limites du compte connecté.

## Installation

Le dépôt est privé : le compte GitHub doit y avoir accès, et l'ordinateur doit déjà pouvoir se connecter à GitHub avec git (clé SSH, ou `gh auth login` puis `gh auth setup-git`). L'installation ne demande pas d'identifiants.

### Méthode A : marketplace GitHub (recommandée)

Dans un terminal :

```bash
claude plugin install context-weather --marketplace Teddy57600/teddy-mods
```

```bash
claude plugin install usage-limits --marketplace Teddy57600/teddy-mods
```

Dans une session Claude Code du terminal, `/plugin install context-weather --marketplace Teddy57600/teddy-mods` fait la même chose : répondez `y` pour ajouter le marketplace, puis choisissez la portée.

Dans l'application desktop : cliquez sur **+** à côté de la zone de prompt, puis **Plugins**, **Add marketplace** avec `Teddy57600/teddy-mods`, puis **Add plugin**.

Pour une mise à jour : augmentez `version` dans le `plugin.json` du mod concerné, poussez la modification sur GitHub, puis lancez `claude plugin update context-weather@teddy-mods` (ou `usage-limits@teddy-mods`).

Pour désinstaller : `claude plugin uninstall context-weather@teddy-mods`.

N'utilisez pas la méthode B en même temps : chaque bande s'afficherait deux fois.

### Méthode B : chargement direct des dossiers (développement)

Clonez le dépôt, par exemple dans `C:\Users\<login>\.claude\teddy-mods`, puis ajoutez ce bloc dans `C:\Users\<login>\.claude\settings.json`. Si le fichier contient déjà des réglages, ajoutez seulement la clé `env` à côté des autres. Sous Windows, les chemins sont séparés par `;` :

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "C:\\Users\\<login>\\.claude\\teddy-mods\\context-weather;C:\\Users\\<login>\\.claude\\teddy-mods\\usage-limits"
  }
}
```

Redémarrez ensuite l'application Claude. Avec cette méthode, une modification des fichiers est prise en compte sans réinstallation.

## Personnalisation

Dans `hooks/register.tsx` de chaque mod :

- `BRAND` : le nom affiché à droite de la carte (`TeddyIA`).
- `forecast` (context-weather) et `level` (usage-limits) : seuils, libellés et couleurs.

## Remarques

- `usage-limits` se met à jour à chaque mesure du moteur (après chaque réponse, et dès qu'une fenêtre bouge d'un point). Au début d'une session, avant la première réponse, il reprend la dernière mesure connue, marquée « Dernière mesure », tant que la fenêtre n'est pas réinitialisée. Il reste vide sans abonnement Claude (clé API, passerelle d'entreprise).
- Les heures de réinitialisation suivent le fuseau horaire de la machine.
