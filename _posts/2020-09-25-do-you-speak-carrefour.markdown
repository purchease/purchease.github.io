---
layout: post
title:  "Do you speak carrefour"
date:   2020-09-25 09:18:34 +0200
author: david
categories: algo
---
## Intro
Un point important dans l'extraction de données d'un ticket de caisse est de reconnaître l'origine de ce ticket.
Facile, il suffit de reconnaitre le logo !
Oui mais :
* le logo est trop altéré pour être reconnu
* le logo n'est tout simplement pas présent

On a besoin, au moins, d'un second indicateur. Bien entendu, l'étape la plus triviale consiste à repérer des mots clés dans le coeur du ticket. (oui dans le coeur, parce que le magasin qui est avenue du Général Leclerc n'est pas un Leclerc ... ). Mais ca ne marche pas à tous les coups. On a besoin d'un petit outil en plus

Tentons de construire un indicateur de l'enseigne à partir de l'ensemble des mots d'un ticket.

## This Receipt is in carrefour, would you like to translate it ?
Prenons l'hypothèse suivante : supposons que les enseignes utilisent des manières suffisamment différentes de représenter leurs articles qui les caractérisent comme une langue. Que peut-on faire avec cette hypothèse ? Construire un indicateur statistique des 'langues' de chaque enseigne, calculer cet indicateur sur un ticket entrant et savoir de quel langue il est le plus proche. 1ère étape, sur quelle entité allons nous construire cet indicateur


### Le dictionnaire
Le dictionnaire parait une bonne idée : à supposer que l'on a construit un corpus des mots rencontrés dans chacune des enseignes, on comptera les mots présents dans un ticket candidat issus des différents dictionnaire.

Le souci avec cette approche : il est très très bon notre OCR, malgré tout, il n'est pas exclu qu'il y ait quelques substitutions. En comparant les mots entiers on ne sera pas robuste au bruit.

### Les lettres
Les lettres nous préservent de l'écueil plus haut : leur nombre est plus élevé et statistiquement les erreurs seront noyées dans la masse. En revanche, on n'est pas en train de comparer du danois et de l'espagnol ; les langues de ticket de caisse sont des dérivées du francais et la fréquence d'apparition des lettres risque de ne pas être suffisamment discriminante.

### Et au milieu, coule un n-gram
On va donc chercher une approche 'au milieu' : on va considérer l'ensemble des successions de n lettres, qu'on appelera n-grams par la suite.
Avec n=3, ca donne :

```ruby
def trigrams(str)
    str.chars.each_cons(3).each_with_object(Array.new) { |v,a| a << v.join }
end

trigrams('HELLO WORLD')
> ["HEL", "ELL", "LLO", "LO ", "O W", " WO", "WOR", "ORL", "RLD"]
```


## Construction des caractéristiques langage
En supposant que l'on dispose d'extraits annotés de ticket correctement classés, on construira les corpus

```ruby
def trgm_cnt labels
    trigrams(labels).each_with_object(Hash.new(0)) do |trgm, hh|
        hh[trgm] += 1
    end
end

def build_corpus
    trgm_freq_by_retailer = {}
    rcpts_dump_by_reatailer.each do |retailer, labels|
        trgm_freq_by_retailer[retailer] = trgm_cnt labels
    end
    trgm_freq_by_retailer
end
```


## Tenir la distance
Résumé des épisodes précédents :  on a une référence de la fréquence des trigrams pour un candidat et pour chacune des enseignes. Maintenant, la compétition est ouverte, que le plus proche gagne !
Au fait, c'est quoi le plus proche ? Il nous reste à définir la distance entre deux caractéristiques. Le souci : on compare un indicateur construit sur  des centaines de tickets à un indicateur construit sur quelques lignes. Il faut rendre les choses comparables.
Voilà la solution la plus robuste que nous proposons : on va comparer les *rangs* des trigrammes classés par ordre de fréquence dans le référentiel et dans le candidat.

```ruby
def compare candidate_freq, ref_freq
    # sort candidate trigrams
    ranked_in_candidate = candidate_freq.sort_by{|k,v| v}.reverse.keys

    ranked_as_in_ref = candidate_freq.keys.sort_by{|trg|  ref_freq[trg] }.reverse

    # index_rank_by_trg
    index_ranked_ref = {}
    ranked_as_in_ref.each_with_index{|trg, rk| index_ranked_ref[trg]= idx  }

    dist = 0
    ranked_in_candidate.each_with_index do |trg, rank|
        dist+= (rank - ranked_as_in_ref[trg]).abs
    end
end
```



## Résultats
Le code est disponible [ici](https://github.com/purchease/purchease.github.io/blob/master/code/2020-09-25-do-you-speak-carrefour/classifier.rb) 




