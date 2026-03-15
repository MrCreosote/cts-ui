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
  urls: string[] | null;
  registered_by: string;
  registered_on: string;
}

export interface Site {
  cluster: string;
  active: boolean;
  available: boolean;
  unavailable_reason: string | null;
  nodes: number | null;
  cpus_per_node: number;
  memory_per_node_gb: number;
  max_runtime_min: number;
  notes: string[];
}

export interface AllowedPath {
  path: string;  // "bucket/prefix/" format
  perm: string;  // e.g. "write"
}

export interface WhoamiResult {
  user: string;
  roles: string[];
  allowed_paths: AllowedPath[];
}

export type ChecksumStatus = 'checking' | 'ok' | 'missing' | 'error';

export interface S3Object {
  key: string;
  size: number;
  lastModified: string;
  checksumAlgorithms: string[];
}

export interface S3FileEntry {
  path: string;       // bucket/key
  hasCrc64nvme: boolean;
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
