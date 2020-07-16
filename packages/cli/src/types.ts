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
