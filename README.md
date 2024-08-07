# Minishoot' Adventures map

[Minishoot' Adventures](https://store.steampowered.com/app/1634860/Minishoot_Adventures/) is an open-world,
top-down metroidvania/bullet hell adventure where you play as a spaceship chosen to fight the corruption that destroyed your home.

This project provides a map for the game, available [here](https://vanaigr.github.io/minishoot-map/).

The map shows enemies, XP crystals, jars, transitions, and environmental colliders.

The data is extracted from the game by replacing the `GameManager.LaunchGame()` method in the game library with [retrieve.cs](./retrieve.cs) using [dnSpyEx](https://github.com/dnSpyEx).
