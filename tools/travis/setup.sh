#!/bin/bash
SCRIPTDIR=$(cd $(dirname "$0") && pwd)
HOMEDIR="$SCRIPTDIR/../../../"

# install node and npm
sudo apt-get -y install nodejs npm
npm install -g codecov
npm install
