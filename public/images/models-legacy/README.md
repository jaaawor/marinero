# Zdjęcia ze starej strony marinero.pl

Jedyne miejsce, w którym te 24 kadry jeszcze istnieją.

Były w manifeście (`scripts/model-image-manifest.json`) jako adresy
`https://marinero.pl/wp-content/uploads/…`, czyli wskazywały na starą stronę na
WordPressie. Po przeniesieniu domeny na nasz serwer te adresy przestały
odpowiadać — producenci tych kadrów nie mają (to zdjęcia z jazd i z targów),
a stary serwer prędzej czy później zostanie wyłączony.

Dlatego jako jedyne zdjęcia modeli **wchodzą do repozytorium**; reszta
(ponad tysiąc plików) jest pobierana przy buildzie i siedzi w `.gitignore`.
`scripts/fetch-model-images.mjs` kopiuje je stąd zamiast pobierać — w podsumowaniu
widać je jako „z repozytorium".

Nazwy plików wynikają z pozycji zdjęcia w manifeście (`<slug>/NN.jpg`), więc
**przy zmianie kolejności w manifeście trzeba je przemianować**, inaczej trafią
pod cudzy model.

Dotyczy modeli: Aquila 28 Molokai / 32 Sport / 42 Coupe / 50 Yacht,
Jeanneau Cap Camarat 7.5 CC i 9.0 WA, Merry Fisher 795 i 895, Sting 485 S,
Sting 610 BR (archiwum), XO DFNDR 8 i 9, DSCVR 9, EXPLR 10.
