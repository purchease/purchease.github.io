---
layout: post
title: "That's the way hmhm hmhm I stack it hmhm hmhm"
date: 2020-09-26 16:02:34 +0200
author: ronnie
categories: architecture
github_comments_issueid: 5
---

Nous partîmes avec une application web monolithique; mais par un prompt renfort de fonctionnalité et de traffic, nous nous vîmes compter des applications dédiées à des sous-parties spécifiques de notre activité (extraction du texte, extraction du contenu structuré, backoffice, analytiques…).

L'un des choix que nous avons faits afin de séparer les code bases a été de cesser de peu à peu abandonner Rails pour le front (hors besoin interne) au profit d'une stack dédiée.

![Nuxt.js](https://fr.nuxtjs.org/logos/nuxtjs-typo.svg){: width="300px"}

<h2 align="center">+</h2>

![Rails](https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Ruby_On_Rails_Logo.svg/1200px-Ruby_On_Rails_Logo.svg.png){: width="300px"}

<h2 align="center">=</h2>

![Love](https://media.istockphoto.com/photos/neon-heart-on-brick-wall-picture-id848235926?k=6&m=848235926&s=612x612&w=0&h=resOh2Qt0_wYIOoLGcbnGtu_rXw5Dkp_IsqrerWzWCQ=){: width="300px"}

Nous avons profité de la livraison d'un backoffice à un client pour se l'approprier en interne également et en faire un exemple de bonnes pratiques de séparation et d'utilisation des fonctionnalités :

- Avoir une manière prévisible et standard d'implémenter une interface (versus autre solution équivalente) pour éviter le coût de la customisation
- Facile à lire, à comprendre et à tester : éviter les jargons non documentés, utiliser postman ou curl
- Rendre évident les rapprochements client <-> serveur (caller <-> action)

## Vues avec Nuxt.js

Historiquement, nous avons commencé notre backoffice sur Ruby on Rails à l'aide de la gem [activeadmin](https://github.com/activeadmin/activeadmin), très agréable au demeurant, mais qui a rapidement montré ses limites lorsqu'il a fallu effectuer des actions plus complexes que du simple CRUD. Nous sommes d'abord passés par de multiples surcharges des configurations par défaut de la gem, puis l'avons fait cohabiter avec des pages construites de manière plus personnalisées, tout en restant à l'intérieur du moule offert par la gem.

Nous avons finalement fait le choix de nous tourner vers [Nuxt.js](https://fr.nuxtjs.org/) pour un backoffice moderne et réactif et dont le code est uniquement dédié à ce que voit l'agent backoffice et à l'expérience de ce dernier. Nuxt.js présente les avantages de faciliter la construction d'une application web from scratch grâce à ses multiples conventions de configuration et d'arborescence fichier, son système de génération automatique de routes ainsi que la rapidité de chargement des pages par rapport au simple
[Vue.js](https://fr.vuejs.org/) dont il est un framework.

## API avec Ruby on Rails

Si nous avons mis de côté Rails tout en un pour le backoffice, il ne reste finalement pas bien loin. Application au centre de tous nos services et connectée à notre base de données principale, nous nous en servons pour en faire l'API qui sert le front construit sous Nuxt.js.

Nous avons en revanche décidé de nous affranchir du MVC classique de Rails et ses conventions RESTful pour adapter une approche minimaliste avec le [#NoREST](https://swaxblog.tumblr.com/post/112611863175/who-cares-about-get-vs-post-norest). Les payloads ne doivent plus représenter des états d'une donnée mais un langage fonctionnel défini entre développeurs front et backend qui gèrent le domaine fonctionnel. Il y a une seule manière de joindre et d'utiliser l'API puis de communiquer dans les deux sens : url + data.

Afin de réduire la complexité de construction des endpoints API, nous avons mis en place sur chaque route une simple exposition à une [mutation](http://devblog.purchease.com/rails/2020/02/12/mutation-rails.html), laquelle se charge d'effectuer l'action métier et de renvoyer le json attendu construit à l'aide d'objets façades construits de consort avec le consommateur front. C'est dans la mutation que se fait toutes les validations du payload et de l'état des objets afin de rendre de manière conventionnée des erreurs à l'adresse du développeur en mode debug ou de l'agent backoffice qui la lira sur son interface.

## Authentification avec Devise-JWT

Cela pourra faire un billet plus complet plus tard mais nous nous aidons de l'extension [Devise-JWT](https://github.com/waiting-for-dev/devise-jwt) pour gérer l'authentification qui se fait avec Devise côté Rails. Il permet l'utilisation d'un [JSON Web Token](https://en.wikipedia.org/wiki/JSON_Web_Token) pour permettre un single sign-on tout en continuant de profiter des avantages liés à l'authentification avec Devise.
