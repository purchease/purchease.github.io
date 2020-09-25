---
layout: post
title:  "Do you speak carrefour"
date:   2020-09-25 09:18:34 +0200
author: david
categories: algo
---

Un point important dans l'extraction de données d'un ticket de caisse est de reconnaitre l'origine de ce ticket. 
Facile, il suffit de reconnaitre le logo ! 
Oui mais : 
* le logo est trop altéré pour être reconnu
* le logo n'est tout simplement pas présent 

On a besoin, au moins, d'un second indicateur. Bien entendu, l'étape la plus triviale consiste à repérer des mots clés dans le coeur du ticket. (oui dans le coeur, parce que le magasin qui est avenue du Génral Leclerc n'est pas un Leclerc ... ). 

Tentons de construire un indicateur de l'enseigne à partir de l'ensemble des mots d'un ticket. 

## This Receipt is in carrefour, would you like to translate it ? 
Prenons l'hypothèse suivante : supposons que les enseignes utilisent des manières suffisamment différentes de représenter leurs articles qui les caractérisent comme une langue. Que peut-on faire avec cette hypothèse ? Construire un indicateur statistique des 'langues' de chaque enseigne, calculer cet indicateur sur un ticket entrant et savoir de quel langue il est le plus proche. 1ère étape, sur quelle entité allons nous construire cet indicateur


### Le dictionnaire
Le dictionnaire parait un bonne idée

### Les lettres
Les lettres nous préservent de l'écueil plus haut. En revanche, on n'est pas en train de comparer du danois et de l'espagnol/ Les langues de ticket de caisse sont des dérivées deu francais

### Et au milieu, coule un ngram



## On recense


## Tenir la distance


## Résultat


## Implémentation



