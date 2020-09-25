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
Le dictionnaire parait une bonne idée : à supposer que l'on a construit un corpus des mots rencontrés dans chacune des enseignes, on comptera les mots présents dans un ticket candidat issus des différents dictionnaire.

Le souci avec cette approche : il est très très bon notre OCR, malgré tout, il n'est pas exclu qu'il y ait quelques substitutions. En comparant les mots entiers on ne sera pas robuste au bruit. 

### Les lettres
Les lettres nous préservent de l'écueil plus haut : leur nombre est plus élevé et statistiquement les erreurs seront noyées dans la masse. En revanche, on n'est pas en train de comparer du danois et de l'espagnol ; les langues de ticket de caisse sont des dérivées du francais et la fréquence d'apparition des lettres risque de ne pas être suffisamment discriminante. 

### Et au milieu, coule un ngram
On va donc chercher une approche 'au milieu' : on va considérer l'ensemble des successions de n lettres, qu'on appelera n-grams par la suite. 
Avec n=3, ca donne : 

```ruby
def trigrams(str)
    str.chars.each_cons(3).each_with_object(Array.new) { |v,a| a << v.join }
end

trigrams('HELLO WORLD')
> ["HEL", "ELL", "LLO", "LO ", "O W", " WO", "WOR", "ORL", "RLD"] 
```


## On recense


## Tenir la distance


## Résultat


## Implémentation



