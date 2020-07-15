import inquirer from 'inquirer';
import process from 'process';
import fs from 'fs';
import path from 'path';
import memFs from 'mem-fs';
import memFsEditor from 'mem-fs-editor';

export interface CliConfig {
  generatorsDir: string;
  toDir: string;
}

export interface GeneratorSchema {
  description: string;
  variables: {
    [name: string]: { type: string; message: string; };
  };
}

export interface GeneratorMeta {
  name: string;
  schema: GeneratorSchema;
}

export interface TmplContext {
  [key: string]: string;
}

function getCliConfig(): CliConfig {
  const cwd = process.cwd();
  let config: CliConfig = {
    generatorsDir: path.resolve(cwd, 'generators'),
    toDir: path.resolve(cwd, 'src'),
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

export async function chooseGenerator() {
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
  const tpmlContext = await initTmplContext(name, schema);

  await copyTmpl(name, tpmlContext, cliConfig);
}

export async function initTmplContext(name: string, schema: GeneratorSchema) {
  if (!schema.variables) {
    return null;
  }

  const questions = Object.entries((schema as GeneratorSchema).variables).map(([key, opts]) => ({ name: key, ...opts }));
  return inquirer.prompt<TmplContext>(questions);
}

export function copyTmpl(name: string, tmplContext: TmplContext | null, config: CliConfig) {
  return new Promise((resolve, reject) => {
    const store = memFs.create();
    const editor = memFsEditor.create(store);

    mapTmplPaths(path.resolve(config.generatorsDir, name), tmplContext)
      .forEach(file => {
        const tmplPath = path.relative(config.generatorsDir, file);
        const distPath = path.join(config.toDir, tmplPath);
        // @ts-ignore
        editor.copyTpl(file, distPath, tmplContext);
      });

    editor.commit((err) => err ? reject(err) : resolve());
  });
}

export function mapTmplPaths(tmplRoot: string, tmplContext: TmplContext | null): string[] {
  return fs.readdirSync(tmplRoot)
    .filter(filename => !/__clipz__\.js/.test(filename))
    .reduce<string[]>((files, file) => {
      const p = path.resolve(tmplRoot, file);
      const appended = fs.statSync(p).isDirectory()
        ? mapTmplPaths(p, tmplContext)
        : [p];
      return [
        ...files,
        ...appended,
      ];
    }, []);
}
