export interface Credentials {
  kbaseToken: string;
  ctsBaseUrl: string;
  s3Endpoint: string;
  s3AccessKey: string;
  s3SecretKey: string;
  proxyUrl: string;
}

export const DEFAULT_CREDENTIALS: Credentials = {
  kbaseToken: '',
  ctsBaseUrl: 'https://berdl.kbase.us/apis/cts',
  s3Endpoint: 'https://minio.berdl.kbase.us',
  s3AccessKey: '',
  s3SecretKey: '',
  proxyUrl: 'http://localhost:3001',
};

export interface Image {
  name: string;
  digest: string;
  tag: string | null;
  entrypoint: string[];
  usage_notes: string | null;
  registered_by: string;
  registered_on: string;
}

export interface Site {
  name: string;
  active: boolean;
  available: boolean;
}

export interface S3Object {
  key: string;
  size: number;
  lastModified: string;
}

export interface S3ListResult {
  prefixes: string[];
  files: S3Object[];
}

export type InputFilesArg = {
  type: 'input_files';
  input_files_format: 'space_separated_list';
};

export type CliArgument = string | InputFilesArg;

export interface JobSubmission {
  cluster: string;
  image: string;
  params: {
    input_mount_point: string;
    output_mount_point: string;
    cli_arguments: CliArgument[] | null;
  };
  num_containers: number;
  cpus: number;
  memory: string;
  runtime: string;
  output_dir: string;
  input_files: string[];
}
