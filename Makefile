NODE=$(shell which node)
NPM=$(shell which npm)
CURL=$(shell which curl)

init:
	npm install

build:
	npm run build

dev:
	npm run dev

dev-compile:
	npm run dev-compile

up: build
	npm start

watch:
	npm run watch
