---
layout: post
title: "Herr Kappelmeister"
date: 2020-09-25 09:18:34 +0200
author: david
categories: architecture
github_comments_issueid: 3
---
## Intro

L'extraction de tickets, de l'analyse d'image jusqu'au répérage des articles et des points requiert une multitudes d'étapes que nous réalisons en tâche de fond.
Selon le contexte ( application d'origine, qualité du ticket, fraude éventuelle) le flow de traitement peut avoir plus ou moins d'étapes.
Afin de les orchestrer nous avons développé un moyen de controller l'ensemble de ces tâches afin que toutes les applications en jeu puissent jouer ensemble la bonne partition.

RESQUE + WORKFLOW = ASYNC_WORKFLOW

L'importance du contrôle des tâches asynchrones a demandé beaucoup d'effort de design et développement que nous allons tenter de répliquer ici pas à pas. 


## Notre cas d'exemple
Supposons que nous avons deux applications complexes, que nous réduirons pour l'exemple à peu de code : la première donne le bulletin météo, la seconde vérifie un agenda. Notre objectif est de donner plannifier notre journée en fonction de ces deux applications.


### Weather expert
Voici le code applicatif, qui nous donne le bulletin météo
```ruby
# weather_export_app/wheather_export.rb

require 'date'
class CheckWeatherReport
  def self.seasons(y)
    {
      spring:  [ "#{y}-03-21",  "#{y}-06-21" ].map{|ts| Date.parse(ts) },
      summer:  [ "#{y}-06-21",  "#{y}-09-21" ].map{|ts| Date.parse(ts) },
      fall:  [ "#{y}-09-21",  "#{y}-12-21" ].map{|ts| Date.parse(ts) },
      winter:  [ "#{y}-12-21",  "#{y}-03-21" ].map{|ts| Date.parse(ts) }
    }
  end

  def self.season_report_mapping
    {
      spring:  {rain: rand > 0.3, temperature: (15 + (5 * rand - 3 )).round , snow: rand > 0.8 },
      summer:  {rain: rand > 0.8, temperature: (25 + (5 * rand - 3 )).round , snow: rand > 1 },
      fall:    {rain: rand > 0.2, temperature: (12 + (5 * rand - 3 )).round , snow: rand > 1 },
      winter:  {rain: rand > 0.9, temperature: (5 + (5 * rand - 3 )).round , snow: rand > 0.2 }
    }
  end

  def self.perform str_date
    date = Date.parse(str_date)
    y = date.strftime('%Y')
    season  = seasons(y).find{|seasons,range| (range.first..range.last).include?(date) }.first
    result = season_report_mapping[season] 
    puts "[CheckWeatherReport] #{result}"
    return result
  end
end

```

Nous décidons dans un premier temps d'exposer ce service sur un api avec Rack :
```ruby
# weather_export_app/web_server.ru

require 'rack/app'
require_relative 'weather_expert.rb'

class WeatherExpert < Rack::App
  get 'report' do
    CheckWeatherReport.perform params['date_as_str']
  end
end

run WeatherExpert

```

Enfin, un script minimal pour lancer le serveur :
```sh
#!/bin/sh
rackup -p 3001 ./web_server.ru

```

On teste notre application :
```sh
 > curl localhost:3001/report?date_as_str=2019-04-02
 {:rain=>true, :temperature=>12., :snow=>false}
```
Notre service est en pleine forme !


### Agenda
Construisons une seconde application 'experte' : celle-ci expose un service permettant de vérifier pour chaque heure de la semaine, mon activité :
```ruby
# agenda_app/agenda.rb
class CheckAgenda
  def self.week_day_schedule
    {
      (7..9) => :kids,
      (9..18) => :work,
      (18..21) => :kids,
      (22..24)    => :sleep,
      (0..7)    => :sleep
    }
  end

  def self.weekend_day_schedule
    {
      (9..11) => :kids,
      (11..16) => :free,
      (16..19)  => :kids,
      (19..24) => :free,
      (0..9) => :sleep,
    }
  end

  def self.day_type ts 
    case ts.wday 
    when (1..5)
      :week_day
    when (6..7)
      :weekend_day
    end
  end

  def self.activity hour, schedule
    schedule.find{|k,v| k.include?(hour) }.last
  end

  def self.perform datetime_as_str
    ts = Time.strptime datetime_as_str, '%Y-%m-%d_%H_%S'
    meth = "#{day_type(ts)}_schedule"
    schedule = send(meth.to_sym)
    result = activity(ts.hour, schedule)
    puts "[CheckAgenda] : #{result}"
    result
  end
end
```
On créera de la même façon un serveur : 
```ruby
require 'rack/app'
require_relative 'agenda.rb'

class Agenda < Rack::App
  get 'activity' do
    CheckAgenda.perform params['datetime_as_str']
  end
end
run Agenda
```
Et de quoi le démarrer
```
#!/bin/sh
rackup -p 3002 ./web_server.ru
```

### Utilisons les !
Notre cas d'usage est le suivant : on a un modèle d'utilisateur pouvant réaliser un certain nombre d'actions : 
```ruby
# scheduler.rb
require 'net/http'
# given a time stamp, what should I do ? 
# I check the wheather, my agenda, and take my decision

class User 
  def run
    puts 'let s run'
  end

  def code_for_fun
    puts 'let s code_for_fun'
  end

  def sleep
    puts 'let s sleep'
  end

  def take_care_of_kids
    puts 'lets  take care of the kids'
  end

  def work 
    puts 'lets work'
  end
end

```
Et un arbre de décision qui s'appuie sur les services météo et agenda pour décider de l'action : 
```ruby
class Scheduler
  def self.select_activity time
    ts = time.strftime("%Y-%m-%d_%H_%S")
    activity_reply = JSON.parse(Net::HTTP.get('localhost', "/activity?datetime_as_str=#{ts}",3002))
    puts activity_reply
    case activity_reply['task']
    when 'kids'
      :take_care_of_kids
    when 'sleep'
      :sleep
    when 'work'
      :work
    when  'free'
      weather_reply = JSON.parse(Net::HTTP.get('localhost', "/report?datetime_as_str=#{ts}",3001))
      puts weather_reply

      if weather_reply['rain'] || weather_reply['snow']
        :code_for_fun
      else
        :run
      end
    end
  end
  def self.activate user, time=Time.now
    activity = select_activity time
    user.send activity
  end
end

Scheduler.activate User.new
# {"task"=>"free"}
# {"rain"=>true, "temperature"=>10, "snow"=>false}
# let s code_for_fun
```

### Les problèmes arrivent
Bien, le problème est posé "et la question est vide répondu". Maintenant, que ce passe-t-il si la question n'est pas "vite répondue" ?
Imaginons que notre service météo s'appuie sur un modèle de forecast extremement complexe, qu'il doive récupérer des images satellites au lieu de faire une recherche dans un hash. Imaginons que notre Agenda consulte réellement un agenda, essaie de contacter les assistants personnels virtuels de nos rendez-vous ou qu'il faille vérifier les horaires de la baby-sitter par sms ? Notre décision ne peut plus être rendue 'live'.

### "Resquousse" : Resque à notre rescousse
Première chose, on va sortir nos jobs trop lourds du chemin d'exécution synchrone sur l'api. Utilisons Resque pour faire en sorte que nos jobs s'exécutent en tâche de fond.
Définissons, pour chaque app le process de jobs asynchrones. Pour cela, nous allons avoir besoin d'un Rakefile, invoquant resque en lui précisant notre code applicatif.
```ruby
# weather_expert_app/Rakefile
require 'resque/tasks'
namespace :resque do
  task :setup do
    require_relative './weather_expert.rb'
  end
end
```
La classe exécute le code applicatif n'est que _très_ légèrement altérée : on précise une file d'attente sur laquelle les jobs de l'app vont être placés et sur laquelle le worker va écouter. Ca sera le seul changement puisque la class avait été écrite dans l'optique d'être exécutable en tant que job Resque avec son ```self.perform```. 
```ruby
# weather_export_app/wheather_export.rb

require 'time'

class CheckWeatherReport
  @queue=:weather_background
#...
end
```
Coté serveur web, on ne va pas changer grand chose non plus : 
```ruby
# weather_export_app/web_server.rb
require 'rack/app'
require_relative 'weather_expert.rb'
require 'json'
require 'resque'

class WeatherExpert < Rack::App
  get 'report' do
    #reply  = CheckWeatherReport.perform params['datetime_as_str']
    reply = Resque.enqueue CheckWeatherReport, params['datetime_as_str']
    reply.to_json
  end

end
run WeatherExpert
```
Sur le service, au lieu d'appeler la classe qui exécute le job, on met le job en file d'attente.

Enfin, il nous faut lancer le worker Resque en plus du serveur : on lance en background la tâche rake correspondant au service de Resque, en lui précisant la queue sur laquelle écouter : 
```sh
#!/bin/sh
cd "$(dirname "$0")"

QUEUE=weather_background rake resque:work &
rackup -p 3001 ./web_server.ru
trap 'kill $(jobs -p)' EXIT
```
On transformera l'application agenda de la même façon.

Si on relance notre application et qu'on l'appelle : 
```ruby
weather_reply = JSON.parse(Net::HTTP.get('localhost', "/report?datetime_as_str=#{ts}",3001))
> true
```
La réponse que l'on obtient est le résultat de la mise en file d'attente du job.
Si on regarde les logs du worker de l'application, on verra passer : 
```ruby 
[CheckWeatherReport] {:rain=>false, :temperature=>14, :snow=>false}
```
La tâche a bien été exécutée par le worker asynchrone !


### Une solution encore bancale
Très bien nos tâches peuvent durer des heures, l'api des applications n'en souffrira pas. Mais, comment j'obtiens mon résultat maintenant que le travail est fait en tâche de fond ? Et comment appliquer ma logique qui est conditionnée par les deux tâches ?
On peut faire en sorte que les tâches rappelent mon applicatif principal lorsqu'elles sont exécutées. On pourra alors appeler la tâche suivante. Mais on pourrait bien avoir à réappliquer souvent cette logique. Tentons d'écrire un middleware qui constituerait une couche d'abstraction gérant la communication afin de se consacrer sur la logique elle-même.

## Ce que l'on veut
![final_design](/assets/images/herr-kappell-meister/final_design.png)

Explications :

Le traitement que l'on souhaite effectuer requiert l'exécution de tâches complexes qui peuvent avoir lieu sur l'application 1 et 2. Ces applications disposent toutes deux de leur DB applicative et d'une DB redis gérant leur tâches asynchrone.

On va définir l'enchainement des tâches dans l'application 'KappelMeister' qui veillera à ce que l'ordonnancement que l'on a planifié se déroule tel qu'on le décide. Pour cela, il doit être notifié de la fin des tâches pour pouvoir passer à la suite, ce qui est le point clé dans l'ordonnancement des tâches en background.

Nous souhaitons que le code soit partagé, afin que le protocole propre à cette tuyauterie soit distribué facilement entre les acteurs.

### La partie abstraite
Tentons de construire le protocole à distribuer sur nos trois apps.
Comme le flow de traitement peut être compliqué, utilisons un automate fini. AASM est super bien, mais nous allons choisir celle issue de la gem 'workflow'.
L'idée est la suivante : l'automate est joué sur l'application KapellMeister. Quand il fait un pas, il execute la tâche correspondante, en passant l'ordre à l'application cible. Elle persiste son état en attendant d'être réveillée.
Quand l'application cible a terminé, elle doit notifier l'application KapellMeister pour qu'elle poursuive l'automate.
Ecrivons le début de la couche abstraite.
Nous aurons besoin d'une définition d'un workflow, d'un controlleur qui les gérera, et de la définition des messages.
Enfin nous aurons besoin de définir les 'Agents' : ce sont les tâches qui seront executées par les applications clientes.


Commençons par créer une classe de controller qui se chargera de gérér nos workflows.
Elle doit pouvoir : 
- créer un workflow 
- faire appel aux tâches (qu'on va désormais appeler des agents)
- mettre à jour un workflow sur une réponse d'un agent
- gérer la persistence des workflows
- maintenir l'annuaire des agents, c'est à dire savoir sur quelle appli chaque agent est déclaré.
```ruby
class WorkflowController
  class << self

    def instantiate wf_key
      klass, id = BaseWorkflow.decode_key wf_key
      serialized = JSON.parse $redis.get wf_key
      klass.from_json serialized
    end

    def persist wf_instance
      $redis.set wf_instance.key, wf_instance.to_json
    end

    def create_workflow wf_klass, params
      klass = Module.const_get wf_klass
      wf = klass.new params
      wf.start!
      persist wf
    end

    def post_create message
      post_message message
    end

    def post_reply message
      post_message message
    end


    def update_workflow_with_reply pl_message
      wf = instantiate pl_message.wf_key
      wf.send("#{pl_message.callback}!".to_sym,  pl.reply)
    end

    def call_agent wf_instance, agent_name, agent_args, call_back
      pl = WorkflowPayload.build_for_agent_call wf_instance.key, agent_name, agent_args, call_back
    end

    def register_agent name, opts
      @http_agents ||= {}
      @http_agents[name.to_s] = opts[:url]
    end

    def register_kappellmeister opts
      @http_agents ||= {}
      @http_agents[:kappellmeister] = opts[:url]
      a_log @http_agents
    end


    def post_message message
      a_log "about to post #{message}"
      if message.type.to_sym == :post_create
        target_url =  "#{@http_agents[:kappellmeister]}/post_create"
      elsif message.type.to_sym == :post_reply
        target_url =  "#{@http_agents[:kappellmeister]}/post_reply"
      elsif message.type == :call_agent
        target_url =  "#{@http_agents[message.agent]}/call_agent"
      end
      a_log "about to post to #{target_url} body -> #{message.to_h}"
      uri = URI(target_url)
      http = Net::HTTP.new(uri.host, uri.port)
      headers = { 'Accept' => 'application/json',
                  'Content-Type' => 'application/json' }
      request = Net::HTTP::Post.new(uri.request_uri, headers)
      request.body = message.to_h.to_json
      reply = http.request(request)
      a_log "reply : #{reply}"
    end

  end
end

```

Définissons maintenant le protocole d'echange entre agents et chef d'ochestre. On va pour cela mettre dans une classe de message les actions et paramètres permettant la réalisation des cas d'usage listés plus haut
```ruby

class WorkflowPayload
    attr_accessor :type, :agent,  :agent_args, :callback, :reply, :wk_key, :creation_params, :wf_klass

    def initialize h
      @type = h['type']
      @agent = h['agent']
      @agent_args = h['agent_args']
      @callback =  h['callback']
      @reply =  h['reply']
      @wk_key = h['wk_key']
      @wf_klass = h['wf_klass']
      @creation_params= h['creation_params']
    end


    def self.build_for_post_creation wf_name, params
      {
        type: 'post_create',
        wf_klass: wf_name,
        creation_params: params
      }
    end


    def self.build_for_creation wf_name, params
      {
        type: 'create',
        wf_klass: wf_name,
        creation_params: params
      }
    end

    def self.build_for_agent_call wk_key, agent_name, agent_args, callback
        pl = new({})
        pl.type = 'agent_call'
        pl.agent = agent_name
        pl.agent_args = agent_args
        pl.wk_key = wk_key
        pl.callback = callback
        pl
    end

    def self.build_for_agent_reply wk_key, callback, reply
        pl = new( {})
        pl.type = 'agent_reply'
        pl.callback = callback
        pl.reply = reply
        pl.wk_key = wk_key
        pl
    end

    def to_h
      {
        type: @type,
        agent: @agent,
        agent_args: @agent_args, 
        callback: @callback,
        reply: @reply,
        wk_key: @wk_key,
        wf_klass: @wf_klass,
        creation_params: @creation_params
      }
    end

end

```

Il nous faudra également la class abstraite de workflow : 
```ruby 
class BaseWorkflow 
  include Workflow
  attr_accessor :id

  def initialize params
  end

  def key
    "#{self.class.name}::#{id}"
  end

  def self.decode_key wf_key
    wf_key.split('::')
  end

  def to_h
    hash_data = {}
    instance_variables.each do |var|
      tuned_var = var.to_s.sub(/^@*/, '')
      hash_data[tuned_var] = instance_variable_get var
    end
    hash_data
  end

  def self.from_hash(hash_data)
    instance = new({})
    hash_data.each do |var, val|
      instance.instance_variable_set "@#{var}", val
    end
    instance
  end

  def self.from_json(string_data)
    from_hash(JSON.parse(string_data))
  end

  def self.register_agent agent_name, opts
    WorkflowController.register_agent agent_name, opts
  end

  def call_agent agent_name, agent_args, call_back
    WorkflowController.call_agent self,  agent_name, agent_args, call_back
  end
end

```

Et enfin, nous allons définir une class de Worker Resque génrérique qui sera capable d'agir en fonction du message recu :


```ruby



class WorkflowWorker

    def self.perform pl_message
      begin 
        a_log "dequeued #{pl_message}"
        message = WorkflowPayload.new pl_message
        case message.type
        when 'post_create'
          WorkflowController.post_message message
        when 'create'
          wf = WorkflowController.create_workflow message.wf_klass, message.creation_params
        when 'agent_call'
          klass = Module.const_get message.agent
          result = klass.perform message.agent_args
          pl_reply = WorkflowPayload.build_for_agent_reply  message.wf_key, message.callback, result
          WorkflowController.post_message pl_reply
        when 'agent_reply'
          wf = WorkflowController.update_workflow_with_reply message
        end
      rescue Exception => e
        a_log e.message
        puts e.backtrace
        raise e
      end

    end
end

```

L'intérêt de ce worker est qu'il est le pivot de toutes les opérations : il va être appelé coté KappellMeister pour gérer les créations d'instance de workflow et coté applicatif pour gérer l'appel aux agents et le protocole de réponse.
En outre on exécute toute la logique elle-même en tâche de fond. Les appels sur les apis se limitent à mettre ce job en file d'attente. L'un des gros intérêt est que si un appel échoue ( par exemple un appel permettant de transférer un message ), on bénéficie de resque-cleaner pour les traquer et les rejouer ; même si une api est down, on pourra au pire rejouet l'appel ! 

### Service privé 
En plus de toutes nos classes abstraites, on va définir notre api privée définissant le protocole : 

```ruby 
# async_workflow/rack_app.rb
require 'rack/app'
require_relative 'async_workflow.rb'
require 'resque'
#ASYNC_WF_API_PATH = 'async_workflow'

class WorflowAgentApp < Rack::App

  payload do
    parser do
      accept :json
      reject_unsupported_media_types
    end
  end

  post '/call_agent' do
    a_log "received #{payload}"
    wf_payload = WorkflowPayload.new payload
    Resque.enqueue WorkflowWorker wf_payload.to_h
  end

  post '/post_reply' do
    a_log "received #{payload}"
    Resque.enqueue_to :kappell, WorkflowWorker, wf_payload.to_h
  end

  post '/post_create' do
    a_log "received #{payload}"
    wf_payload = WorkflowPayload.new payload
    wf_payload.type = :create
    Resque.enqueue_to :kappell, WorkflowWorker, wf_payload.to_h
  end
end
```


... et on pourra grâce à la magie de Rack la déployer sur toutes nos applications.

### Coté applicatif
On inclut dans l'application la dépendance à notre librairie.
On monte le point d'api 'privée'.

```ruby
  mount WorflowAgentApp
```

Sur l'appli principale, on modifie notre point d'entrée : 
Traiter notre tâche compliquée revient à la déléguer au workflow !

```ruby
  get 'async_activate' do
    message = WorkflowPayload.build_for_post_creation 'ActivityWorkflow', {name: params['user_name']}
    Resque.enqueue_to(:main, WorkflowWorker, message.to_h)
  end
```


### Conductor side
Nous n'avons pas encore créé nontre nouvelle application qui va orchester tout ce travail.

Il lui faut : une api qui expose les services de notre protocole : 
```ruby 
# web server for kapel meister
require_relative '../async_workflow/rack_app'
require_relative './kappellmeister.rb'
class KappelApi < Rack::App
  mount WorflowAgentApp
end
run KappelApi
```

Il lui faut un worker. 


Et bien sûr ....la défintion de notre workflow : 
```ruby
require_relative '../async_workflow/async_workflow.rb'

class ActivityWorkflow < BaseWorkflow
  attr_accessor :name

  def initialize params
    @name = params['name']
    @id = name
  end

  workflow do
    state :created do
      event :start, transitions_to: :checking_agenda
    end

    state  :checking_agenda do
      event :notify_activity, transitions_to: :notifying_activity
      event :weather_report_needed, transitions_to: :checking_weather
    end

    state  :checking_weather do
      event :notify_activity, transitions_to: :notifying_activity
    end

    state :notifying_activity do
      event :notified, transitions_to: :finished
    end

  end

  register_agent 'CheckWeatherReport', url: 'localhost:3001'
  register_agent 'CheckAgenda', url: 'localhost:3002'
  register_agent 'UpdateUserActivity', url: 'localhost:3000'

  def on_checking_agenda_entry(_prior_state, _triggering_event, *_event_args)
    call_agent 'CheckAgenda', {date: Date.today.to_s }, :update_with_schedule
  end

  def on_checking_weather_entry(_prior_state, _triggering_event, *_event_args)
    call_agent 'CheckWhetherReport', {date: Date.today.to_s }, :update_with_weather
  end

  def on_notifying_activity_entry(_prior_state, _triggering_event, *_event_args)
    call_agent 'UpdateUserActivity', {user_name: @user_name }, :notified
  end

  def update_with_schedule! agent_reply
    if agent_reply[:task] != 'free'
      @activity = agent_reply[:task]
      notify_activity!
    else
      weather_report_needed!
    end
  end

  def update_with_weather agent_reply
    if agent_reply['rain'] || agent_reply['snow']
      @activity = code_for_fun
    else
      @activity = run
    end
    notify_activity!
  end
end
```

Il hérite de notre classe abstraite et definit sa propre logique d'enchainement des opérations. On s'appuis pour cela sur l'élégance de la gem workflow. Toute la tuyauterie est déléguée à la lib, et il ne nous reste que la partie fonctionnelle de l'ensemble des tâches.

## Pour aller plus loin
En plus de rendre le code plus robuste que celui présenté ici, il faudra également ajouter un lock sur les clés de stockage des workflow et assurer que le worker a toujours le lock avant de modifier quoique ce soit afin de garantir l'intégrité du déroulement. 

On aura également envie d'utiliser des mutations au lieu des classes de worker de base.

