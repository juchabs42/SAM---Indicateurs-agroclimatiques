INDICATEURS AGROCLIMATIQUES — PROTOTYPE GITHUB PAGES
====================================================

CONTENU
-------
- index.html : structure de l’application
- style.css  : mise en forme responsive
- app.js     : récupération des données, calculs et graphiques

FONCTIONNALITÉS
---------------
- géolocalisation automatique avec autorisation du navigateur ;
- saisie manuelle de latitude et longitude ;
- récupération de données horaires Open-Meteo ;
- VPD horaire ;
- nombre d’heures au-dessus de plusieurs seuils ;
- déficit climatique cumulé ;
- prise en compte de 100 % de la pluie ;
- affichage adapté aux téléphones.

DONNÉES UTILISÉES
-----------------
Le prototype interroge l’API Open-Meteo Forecast avec :
- temperature_2m ;
- relative_humidity_2m ;
- precipitation en horaire ;
- precipitation_sum en quotidien ;
- et0_fao_evapotranspiration en quotidien.

Le VPD est recalculé dans le navigateur à partir de la température et de l’humidité relative.

Il demande :
- 30 jours passés ;
- 7 jours de prévision ;
- le fuseau horaire automatique.


MISE EN LIGNE SUR GITHUB PAGES
------------------------------
1. Créer un dépôt GitHub, par exemple :
   indicateurs-agroclimatiques

2. Ajouter à la racine :
   - index.html
   - style.css
   - app.js

3. Ouvrir :
   Settings > Pages

4. Choisir :
   - Source : Deploy from a branch
   - Branch : main
   - Folder : / (root)

5. Enregistrer.

Adresse future :
https://VOTRE-COMPTE.github.io/indicateurs-agroclimatiques/

GÉOLOCALISATION
---------------
La géolocalisation du navigateur fonctionne normalement uniquement :
- sur une page HTTPS ;
- ou en local sur localhost.

GitHub Pages utilise HTTPS et convient donc à cette fonction.

CALCUL DU DÉFICIT CLIMATIQUE
----------------------------
Calcul quotidien :
ET0 - pluie × coefficient de pluie efficace

Le calcul prend en compte 100 % de la pluie et autorise un bilan négatif.

Le nom recommandé est « déficit climatique cumulé ».
Ce calcul ne représente pas le stock hydrique réel du sol.

LIMITES
-------
- Open-Meteo fournit une donnée modélisée, pas une mesure dans le verger.
- Le VPD seul ne permet pas de conclure à un stress hydrique.
- Le déficit climatique n’intègre pas le sol, l’enracinement, le Kc ou l’irrigation.
 
SEUILS VPD UTILISÉS
-------------------
- moins de 1 kPa : demande atmosphérique faible ;
- 1 à moins de 2 kPa : demande modérée ;
- 2 à moins de 3 kPa : demande élevée ;
- 3 kPa et plus : demande très élevée.

Ces classes sont des repères opérationnels et non des seuils universels de stress.
La réponse varie selon l’espèce, le cultivar, le rayonnement et l’état hydrique du sol.
