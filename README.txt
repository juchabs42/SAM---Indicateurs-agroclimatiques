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
 
SEUILS DPV UTILISÉS
--------------------
- 0 à 1,0 kPa : faible demande atmosphérique ;
- 1,0 à 1,5 kPa : conditions favorables ;
- 1,5 à 2,5 kPa : début de régulation stomatique ;
- 2,5 à 3,5 kPa : contrainte atmosphérique élevée ;
- 3,5 à 4,5 kPa : stress sévère ;
- plus de 4,5 kPa : stress extrême.

HEURES CUMULÉES
---------------
- DPV > 1,5 kPa : durée de régulation stomatique potentielle ;
- DPV > 2,5 kPa : durée de contrainte atmosphérique importante ;
- DPV > 3,5 kPa : durée de stress sévère ;
- DPV > 4,5 kPa : durée de stress extrême.
