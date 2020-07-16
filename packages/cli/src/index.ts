import inquirer from 'inquirer';
import {GeneratorSchema, TmplContext} from './types';
import {extractGeneratorsMeta, loadCliConfig} from './utils';
import {copyTmpl} from './tmpl';

/**
 * Choose a generator from the generator directory.
 */
export async function chooseGeneratorInteractively() {
  const cliConfig = loadCliConfig();

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
  const tpmlContext = await initContextInteractively(name, schema);

  await copyTmpl(name, tpmlContext, cliConfig);
}

/**
 * Initialize the template context of the selected generator.
 * @param name
 * @param schema
 */
export async function initContextInteractively(name: string, schema: GeneratorSchema) {
  if (!schema.variables) {
    return null;
  }

  const questions = Object.entries((schema as GeneratorSchema).variables).map(([key, opts]) => ({name: key, ...opts}));
  return inquirer.prompt<TmplContext>(questions);
}
