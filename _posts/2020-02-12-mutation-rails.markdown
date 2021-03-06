---
layout: post
title: "Les mutations avec rails"
date: 2020-02-12 15:18:34 +0200
author: david
categories: rails
---


## Intro
On commence un projet la fleur au fusil avec des modèles légers, leurs test unitaires et quelques méthodes qui nous permettent le le manipuler. Au fil du temps, on ajoute des méthodes pour régir le comportement du modèle, et puis d'autres et puis d'autres. On se réveille un jour avec des fichiers de 1000 lignes illisibles. Pour éviter cela, on peut étendre son modèle avec des Concerns dans rails, permettant de répartir du code attaché dans des fichiers différents touchant à des aspects différents du modèle. Mais pour les opérations plus compliquées, qui peuvent manipuler plusieurs modèles, il faut autre chose.


## Mutations
Les mutations sont des classes rendues disponibles par la gem [mutations](https://github.com/cypriss/mutations). On l'ajoute au Gemfile et peut commencer à l'utiliser. 
Pour précision, les mutations sont une implementation ruby d'un design pattern de commande. 


## Utilisation par l'exemple
### L'exemple
Disons qu'on a très envie d'écrire une commande permettant de récupérer l'évolution des montants dépensés sur des achats caractérisés par une expression régulière dans leur libellé.

Pour la suite on considérera le modèle suivant : 
```ruby
class Purchase < ApplicationRecord
    belongs_to :user_id
    belongs_to :line 

    attr_accessible :unit_price, :quantity, :user_id
```

```ruby
class Line < ApplicationRecord
    belongs_to :denomination

    attr_accessible :value
```

Notre but : pour une expression régulière donnée, représenter l'évolution de la part dépenses des utilisateurs sur leurs achats dont le libellé match cette expression régulière. 


### Allons-y !
On commence facile, on déclare la classe. Attention, pas *si* facile que ca : c'est une commande, on va donc utiliser un verbe pour la nommer !
Le point d'entrée est la méthode execute, dont on fera l'implémentation plus tard

```ruby
class RetrieveSpendingsByMonth < Mutations::command
    def execute
    end
end
```

Ensuite, on aime bien les mutations parce qu'elle nous  permettent de définir les arguments et d'assurer qu'ils sont valides et fournis lors de l'appel : dans notre cas, on a envie d'une regexp, d'une date de début et d'une date de fin.

```ruby
class RetrieveSpendingsByMonth < Mutations::command
    required do 
        string :reg_exp_as_string
        string :start_date_as_string
        string :end_date_as_string
    end
end
```
Note : la gem supporte de passer des types plus élaborés, voire des modèles activeRecord. Cependant, comme on le verra plus bas, on peut avoir envie d'utiliser ces mutations de manière asynchrone. Comme on n'a pas envie de prendre de risque au moment de la serialisation, on va utiliser des string et le faire savoir grâce au nommage

### Des methodes explicites... avec memoization
Alors, ce qui suit n'est pas inhérent aux mutations, mais d'une part c'est une manière élégante de coder les choses et, comme on le verra dans la partie debug, ca va nous être très utile pour repérer les boulettes. 

Comme on a utilisé des strings, on a envie d'avoir les 'vrais objets', visibles dans toute la mutation :

```ruby

  def start_date
    @start_date ||= start_date_as_string.to_date
  end

  def end_date
    @end_date ||= end_date_as_string.to_date
  end

```
On pourra alors joyeusement utiliser les méthodes reg_ex / start_date / end_date à notre gré dans les méthodes de notre mutation. Le code de traduction ne sera executé qu'une fois !


### Les requêtes
On va chercher à récuperer l'ensemble des dépenses sur les libellés selectionnés, et on voudra normaliser par la somme des achats enregistrés sur la même période : 

```ruby
   def spendings_by_month
     @spendings_by_user_id ||= Purchase.includes(:receipt).joins([:receipt, :line]).where("receipts.created_at between ? and ?", start_date, end_date).where('lines.denomination_id in (?)', denom_ids).each_with_object(Hash.new(0)) do |purchase, h|
       h[purchase.bought_at.strftime('%Y-%m')] += purchase.unit_price_value * purchase.quantity
    end
  end

  def denom_ids
    @denom_ids ||= Denomination.where('value ~* ?', regular_expression).pluck(:id)
  end


  def total_recorded_by_user_id
    @total_recorded_by_user_id ||= Receipt.where(' created_at between ? and ? ', start_date, end_date).select('total, created_at').each_with_object(Hash.new(0)) do |rcpt, h|
      h[rcpt.created_at.strftime('%Y-%m')] += (rcpt.total || 0).to_f
    end
  end

```


### L'execution
On fait le minumum dans la méthode principale pour être lisible : 
```ruby
  def execute
    share = {}
    total_recorded_by_user_id.each do |m, spent|
      share[m] = spendings_by_month[m] / spent
    end
    share
  end
```

Et on lance :

```ruby
RetrieveSpendingsByMonth.run! start_date: '2018-06-01', end_date: '2019-06-01', reg_exp_as_string: '\\mGILE?T?\\M.*(REFL|ORA|JAU|SECU)'
```

Au passage, qu'apprend-on ? Que les ventes de gilets jaunes ont curieusement augmenté en novemebre / décembre 2018  !

![gilets_evo](/assets/images/2020-02-12-mutation-rails/gilets_evo.png)

## Icing on the cake : Debug
Mainteant, pourquoi cet effort de design paie-t-il ?
Grâce à la memoization et au pattern de commande isolé dans une classe, je peux très facilement tester de manière unitaire mon code : 
( ici avec pry , mais irb fonctionnerait aussi )

```ruby
pry RetrieveSpendingsByMonth.new start_date: '2018-06-01', end_date: '2019-06-01', reg_exp_as_string:  '\\mGILE?T?\\M.*(REFL|ORA|JAU|SECU)'
>
```
Je suis dans le contexte de ma mutation, je peux appeler mes méthodes : 

```ruby
pry RetrieveSpendingsByMonth.new start_date: '2018-06-01', end_date: '2019-06-01', reg_exp_as_string: '\\mGILE?T?\\M.*(REFL|ORA|JAU|SECU)'
> start_date

> spendings_by_month
```
Inutile de jouer des initialisations, le pattern de memoization initialize ce dont j'ai besoin lors du premier appel.


## Cherry on the iced cake : AsyncMutation

Parfois ces commandes peuvent être des calculs et des requêtes couteuses qu'on a envie d'exécuter en background (sur un job asynchrone).


```ruby
class MutationsAsyncCommand < Mutations::Command
  @queue = :asynctasks

    def run_async!(*args)
      validate_yield!(*args) { Resque.enqueue(self, *args) }
    end

    def self.perform(*args)
        run!(*args)
    end
    private
    def validate_yield!(*args)
      validation_outcome = validate(*args)
      if validation_outcome.success?
        yield
      else
        raise Mutations::ValidationException, validation_outcome.errors
      end
    end

end
```

avec la légère modification suivante :


```ruby
class RetrieveSpendingsByMonth < MutationsAsyncCommand
 #
end
```

- je béneficie d'une méthode run_async! qui va mettre le job sur une queue. Un worker pourra la prendre et l'executer en tâche de fond.
- les validations se font avant la mise en queue du job ! Si mes paramètres sont incorrects, l'exception sera léevé à la mise en file d'attente et non lors de l'execution asynchrone.


