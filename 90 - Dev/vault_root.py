#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Корень хранилища (vault) для инструментария 90 - Dev.

Расположение может быть двумя (оба поддерживаются, см. комментарий в vault-root.js):

  1) инструментарий внутри хранилища — <vault>/90 - Dev/* → корень = <dev>/..;
  2) инструментарий рядом с хранилищем — <dev>/../Lecture-Graph-Vault/*.

Раньше скрипты жёстко считали корнем вариант 2 и падали в самом репозитории
(ENOENT на .obsidian/plugins/lecture-graph/data.json)."""
import os


def vault_root(dev_dir):
    nested = os.path.abspath(os.path.join(dev_dir, "..", "Lecture-Graph-Vault"))
    if os.path.isdir(os.path.join(nested, ".obsidian")):
        return nested
    return os.path.abspath(os.path.join(dev_dir, ".."))


if __name__ == "__main__":
    print(vault_root(os.path.dirname(os.path.abspath(__file__))))
