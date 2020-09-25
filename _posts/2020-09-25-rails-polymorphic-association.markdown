---
layout: post
title: "Association Polymorphique"
date: 2020-09-25 09:18:34 +0200
author: david
categories: rails
github_comments_issueid: 4
---

## Motivation

Sur l'application FidMarques, on offre aux utilisateurs des mécaniques différentes de fidélisation. A titre d'exemple, on récompense nos utilisateurs par un point de fidélité pour chaque Euro dépensé sur la marque ou bien par une pièce de puzzle pour chaque produit différent acheté sur la marque.

Comme les mécaniques sont très différentes, on aura choisi des modèles distincts pour les représenter. Malgré tout, on aura envie d'associer ces modèles, par exemple à un utilisateur, avec une abstraction indépendante du modèle.
Typiquement, un utilisateur aura des cartes de fidélités (certaines étant des souscriptions à un programme à point, certaines étant des souscriptions à un programme puzzle). Il serait fastidieux, partout dans le code de devoir les différencier, et compliqué d'ajouter une nouvelle mécanique.

## Fonctionnement en pratique

Considérons le modèle suivant :

```ruby
class User < ApplicationRecord

end
```

On cherche maintenant à représenter la souscription à un programme ( il s'agit en fait d'un modèle de jointure entre un utilisateur et un programme ) ;
Voilà ce que l'on a envie d'écrire :

```ruby
class LoyaltyProgramUser < ApplicationRecord
  belongs_to :user
  belongs_to :loyalty_program
end
```

### Le chemin de l'héritage

Ca serait terminé si on avait un modèle LoyaltyProgram. On pourrait tout à fait imaginer le modèle suivant :

```ruby
class LoyaltyProgram < ApplicationRecord

end

class LoyaltyProgramWithPoints < LoyaltyProgram

end

class LoyaltyProgramWithPuzzle < LoyaltyProgram

end
```

On a terminé ! Les deux types de programme héritent d'une même classe : l'héritage en rails nous permet de faire çà, qui se traduira par l'existence d'une table loyalty_programs, avec une colonne type permettant de spécifier la sous-classe.
Cette solution est très satisfaisante dans de nombreuses situations. Il existe un écueil : si nos modèles'fils' ont très peu de caractéristiques communes, la table devrait accueillir l'union des attributs nécessaires au fonctionnement de chacun d'eux, dont la moitié sera inutile selon quelle classe est instanciée.

### Il y a un autre chemin

Partons donc du principe que nos modèles sont différents :

```ruby
class LoyaltyProgramWithPoints < ApplicationRecord

end

class LoyaltyProgramWithPuzzle < ApplicationRecord

end
```

On définira notre relation ainsi :

```ruby
class LoyaltyProgramUser < ApplicationRecord
    belongs_to :user
    belongs_to :loyalty_program, polymorphic: true
end

```

On pourra également définir la relation inverse en spécifiant un nom 'générique' :

```ruby
class LoyaltyProgramWithPoints < ApplicationRecord
    has_many :loyalty_program_users, as: loyalty_program
end

class LoyaltyProgramWithPuzzle < ApplicationRecord
    has_many :loyalty_program_users, as: loyalty_program
end
```

### Et en base de données ?

Les migrations sous-jacentes ressembleront à ca ;

```ruby
class CreateLoyaltyProgramUser < ActiveRecord::Migration[5.2]
  def change
    create_table :loyalty_program_users do |t|
      t.bigint  :user_id
      t.bigint  :loyalty_program_id
      t.string  :loyalty_program_type
      t.timestamps
    end

    add_index :loyalty_program, [:loyalty_program_type, :loyalty_program_id]
  end
end
```

( On n'oublie pas l'index sur les deux colonnes !!! ).

Pour ceux qui veulent briller en société, il existe un raccourci :

```ruby
class CreatePictures < ActiveRecord::Migration[5.0]
  def change
    create_table :pictures do |t|
      t.string :name
      t.references :loyalty_program, polymorphic: true
      t.timestamps
    end
  end
end
```

Reférence : [https://guides.rubyonrails.org/association_basics.html#polymorphic-associations](https://guides.rubyonrails.org/association_basics.html#polymorphic-associations)
