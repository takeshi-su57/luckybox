#!/usr/bin/env node
const { execute } = require("@oclif/core");

void execute({ development: true, dir: __dirname });
