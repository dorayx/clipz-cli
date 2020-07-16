import process from 'process';
import path from 'path';
import fs from 'fs';
import {CliConfig, GeneratorSchema} from './types';

/**
 * Load CLI configuration data from the file: package.json, clipz.js
 */
export function loadCliConfig(): CliConfig {
  const cwd = process.cwd();
  let config: CliConfig = {
    generatorsDir: path.resolve(cwd, 'generators'),
    toDir: path.resolve(cwd, 'src'),
  };

  try {
    // from package.json
    const pkgJsonPath = path.resolve(cwd, 'package.json');
    fs.accessSync(path.resolve(cwd, 'package.json'), fs.constants.R_OK);
    const pkgConfig = JSON.parse(fs.readFileSync(pkgJsonPath).toString())?.clipz ?? {};
    config = {
      ...config,
      ...pkgConfig,
    };
  } catch (e) {
  }

  try {
    // from clipz.js
    const cfgJsPath = path.resolve(cwd, 'clipz.js');
    fs.accessSync(cfgJsPath, fs.constants.R_OK);
    const jsConfig = require(cfgJsPath) ?? {};
    config = {
      ...config,
      ...jsConfig
    };
  } catch (e) {
  }

  return config;
}

/**
 * Extract all the generator meta data from the specified generator directory
 * @param generatorsDir
 */
export function extractGeneratorsMeta(generatorsDir: string): [string[] | null, GeneratorSchema[] | null] {
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
