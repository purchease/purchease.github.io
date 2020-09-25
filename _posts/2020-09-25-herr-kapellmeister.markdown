---
layout: post
title:  "Herr Kappelmeister"
date:   2020-09-25 09:18:34 +0200
author: david
categories: architecture
---

L'extraction de tickets, de l'analyse d'image jusqu'au répérage des articles et des points requiert une multitudes d'étapes que nous réalisons en tâche de fond.
Selon le contexte ( application d'origine, qualité du ticket, fraude éventuelle) le flow de traitement peut avoir plus ou moins d'étapes.
Afin de les orchestrer nous avons développé un moyen de controller l'ensemble de ces tâches afin que toutes les applications en jeu puissent jouer ensemble la bonne partition.


RESQUE + WORKFLOW  = ASYNC_WORKFLOW 


## Setup
### client side
### conductor side

