import inquirer from 'inquirer';
import process from 'process';
import fs from 'fs';
import path from 'path';

export interface CliConfig {
  generatorsDir: string;
}

export interface GeneratorSchema {
  description: string;
  variables: {
    [name: string]: { type: string; message: string; };
  };
}

function getCliConfig(): CliConfig {
  const cwd = process.cwd();
  let config: CliConfig = {
    generatorsDir: path.resolve(cwd, 'generators'),
  };

  try {
    const pkgJsonPath = path.resolve(cwd, 'package.json');
    fs.accessSync(path.resolve(cwd, 'package.json'), fs.constants.R_OK);
    const pkgConfig = JSON.parse(fs.readFileSync(pkgJsonPath).toString())?.clipz ?? {};
    config = {
      ...config,
      ...pkgConfig,
    };
  } catch (e) {}

  try {
    const cfgJsPath = path.resolve(cwd, 'clipz.js');
    fs.accessSync(cfgJsPath, fs.constants.R_OK);
    const jsConfig = require(cfgJsPath) ?? {};
    config = {
      ...config,
      ...jsConfig
    };
  } catch (e) {}

  return config;
}

function extractGeneratorsMeta(generatorsDir: string): [string[] | null, GeneratorSchema[] | null] {
  try {
    const dirPath = path.resolve(process.cwd(), generatorsDir);
    fs.accessSync(dirPath, fs.constants.R_OK);

    const generators = fs.readdirSync(dirPath)
      .filter(p => fs.statSync(path.resolve(dirPath, p)).isDirectory())
      .filter(p => {
        try {
          fs.accessSync(path.resolve(dirPath, p, '__clipz__.js'), fs.constants.R_OK);
          return true;
        } catch (e) {
          return false;
        }
      });

    const names = generators.map(p => p.split(path.delimiter).pop()!);
    const schemas = generators.map(p => require(path.resolve(dirPath, p, '__clipz__.js')));
    return [names, schemas];
  } catch (e) {
    // generators not initialize, use `clipz --init`
    return [null, null];
  }
}

export const bootstrap = async () => {
  const cliConfig = getCliConfig();

  const [generatorNames, generatorSchemas] = extractGeneratorsMeta(cliConfig.generatorsDir);
  if (!generatorNames) {
    // exception: no generator found
    return;
  }

  const selected = await inquirer.prompt([
    {
      type: 'list',
      name: 'generator',
      message: 'Which generator to use?',
      choices: generatorNames.map((name, index) => ({
        name: `${name}${generatorSchemas?.[index]?.description ? `\t-\t${generatorSchemas?.[index].description}` : ''}`,
        short: name,
        value: [name, generatorSchemas?.[index]]
      }))
    }
  ]);

  const [name, schema] = selected.generator;
  if (schema.variables) {
    const questions = Object.entries((schema as GeneratorSchema).variables).map(([key, opts]) => ({ name: key, ...opts }));
    await inquirer.prompt(questions);
  }

};
