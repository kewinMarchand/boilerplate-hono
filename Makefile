.DEFAULT_GOAL := help

export HOST_UID := $(shell id -u)
export HOST_GID := $(shell id -g)

COMPOSE ?= docker compose
# Préfixe des commandes Node : le conteneur api lancé, en local comme en CI.
EXEC ?= $(COMPOSE) exec -T api
YARN = $(EXEC) yarn -s
# Conteneur api ponctuel, sans MongoDB : installation et hook Git, pile lancée ou non.
RUN = $(COMPOSE) run --rm --no-deps api

include Makefile.qa.mk

help: ## Affiche cette aide
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: build ## Construit l'image, installe les dépendances et les hooks Git (dans le conteneur), lance les conteneurs
	$(RUN) yarn install --frozen-lockfile
	$(MAKE) up

build: ## Construit l'image Docker de développement
	$(COMPOSE) build

up: ## Lance l'API (http://localhost:8091) et MongoDB
	$(COMPOSE) up -d --wait

down: ## Arrête les conteneurs (la base est conservée dans son volume)
	$(COMPOSE) down

logs: ## Suit les journaux des conteneurs
	$(COMPOSE) logs -f

sh: ## Ouvre un shell dans le conteneur de l'API
	$(COMPOSE) exec api sh

mongo-sh: ## Ouvre mongosh sur la base de dev
	$(COMPOSE) exec mongo mongosh -u app -p app --authenticationDatabase admin app

db-reset: ## Recrée la base de dev : collections validées, index, fixtures
	$(YARN) db:reset

db-translations: ## Base de dev existante : ajoute les traductions anglaises dormantes des fixtures, sans recréer la base
	$(YARN) db:translations

admin: ## Crée un compte de l'admin /admin, ou change son mot de passe : make admin EMAIL=moi@exemple.fr
	@test -n "$(EMAIL)" || { echo "Préciser l'adresse : make admin EMAIL=moi@exemple.fr"; exit 1; }
	@printf 'Mot de passe : '; stty -echo; read -r P; stty echo; echo; printf '%s\n' "$$P" | $(YARN) admin:create "$(EMAIL)"

openapi: ## Exporte le schéma OpenAPI dans openapi.json
	$(YARN) openapi

contract: ## Compare les réponses de l'API Platform (8090) et de cette API (8091), lancées toutes deux
	$(COMPOSE) run --rm contract

lint-staged: ## Vérifie les fichiers indexés (appelé par le hook pre-commit)
	$(RUN) yarn -s lint-staged

docker-build-prod: ## Construit l'image de production
	docker build --target prod -t boilerplate-hono:prod .

.PHONY: help install build up down logs sh mongo-sh db-reset db-translations admin openapi contract lint-staged docker-build-prod
