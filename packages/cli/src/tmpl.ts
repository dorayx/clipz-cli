import {CliConfig, TmplContext} from './types';
import memFs from 'mem-fs';
import memFsEditor from 'mem-fs-editor';
import path from 'path';
import fs from 'fs';

/**
 * Get all the paths of the template files on the specified directory
 * @param tmplRoot
 * @param tmplContext
 */
export function getTmplPaths(tmplRoot: string, tmplContext: TmplContext | null): string[] {
  return fs.readdirSync(tmplRoot)
    .filter(filename => !/__clipz__\.js/.test(filename))
    .reduce<string[]>((files, file) => {
      const p = path.resolve(tmplRoot, file);
      const appended = fs.statSync(p).isDirectory()
        ? getTmplPaths(p, tmplContext)
        : [p];
      return [
        ...files,
        ...appended,
      ];
    }, []);
}

/**
 * Copy and render the template files with the context data to another directory.
 * @param generatorName
 * @param tmplContext
 * @param config
 */
export function copyTmpl(generatorName: string, tmplContext: TmplContext | null, config: CliConfig) {
  return new Promise((resolve, reject) => {
    const store = memFs.create();
    const editor = memFsEditor.create(store);

    getTmplPaths(path.resolve(config.generatorsDir, generatorName), tmplContext)
      .forEach(file => {
        const fromPath = path.relative(config.generatorsDir, file);
        const distPath = path.join(config.toDir, fromPath);
        // @ts-ignore
        editor.copyTpl(file, distPath, tmplContext);
      });

    editor.commit((err) => err ? reject(err) : resolve());
  });
}
