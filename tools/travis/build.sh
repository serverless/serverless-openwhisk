#!/bin/bash
SCRIPTDIR=$(cd $(dirname "$0") && pwd)
HOMEDIR="$SCRIPTDIR/../../../"

# Start Serverless related runs -------------
cd $HOMEDIR;
touch $HOMEDIR./serverless-openwhisk/serverless.yml;
echo $'provider: \n  name: openwhisk \n  ignore_certs: true \n' > $HOMEDIR./serverless-openwhisk/serverless.yml;
cat $HOMEDIR./serverless-openwhisk/serverless.yml;

npm install --global serverless $HOMEDIR./serverless-openwhisk

cd $HOMEDIR./serverless-openwhisk
npm run test
exitstatus=$?

rm $HOMEDIR/./serverless-openwhisk/serverless.yml
exit $exitstatus
