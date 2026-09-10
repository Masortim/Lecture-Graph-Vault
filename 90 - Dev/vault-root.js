/* Корень хранилища (vault) для инструментария 90 - Dev.

   Возможны два расположения, и оба должны работать:

     1) инструментарий ВНУТРИ хранилища — так устроен этот репозиторий:
        <vault>/90 - Dev/*  →  корень = <dev>/.. (там лежит .obsidian);
     2) инструментарий РЯДОМ с хранилищем — так гоняли пайплайн, когда сам
        репозиторий был только набором скриптов:
        $HOME/90 - Dev/*  +  $HOME/Lecture-Graph-Vault/*  →  корень = <dev>/../Lecture-Graph-Vault.

   Скрипты раньше были жёстко привязаны к варианту 2 и падали (ENOENT) в варианте 1,
   то есть в самом репозитории. Здесь расположение определяется один раз по наличию
   .obsidian, поэтому копия инструментария «едет» вместе с хранилищем и не ломается. */
const fs = require("fs");
const path = require("path");

module.exports = function vaultRoot(devDir) {
  const nested = path.resolve(devDir, "..", "Lecture-Graph-Vault");
  if (fs.existsSync(path.join(nested, ".obsidian"))) return nested;
  return path.resolve(devDir, "..");
};
