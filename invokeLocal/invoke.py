#!/usr/bin/env python2.7

import argparse
import json
import sys
from time import time
from importlib import import_module

parser = argparse.ArgumentParser(
    prog='invoke',
    description='Runs a Lambda entry point (handler) with an optional event',
)

parser.add_argument('handler_path',
                    help=('Path to the module containing the handler function,'
                          ' omitting ".py". IE: "path/to/module"'))

parser.add_argument('handler_name', help='Name of the handler function')

if __name__ == '__main__':
    args = parser.parse_args()

    # this is needed because you need to import from where you've executed sls
    sys.path.append('.')

    module = import_module(args.handler_path.replace('/', '.'))
    handler = getattr(module, args.handler_name)

    event = json.load(sys.stdin)
    result = handler(event)
    sys.stdout.write(json.dumps(result, indent=4))
