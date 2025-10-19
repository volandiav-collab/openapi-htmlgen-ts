export type UnifiedSchemaProperty = {
  name: string;
  type?: string | null;
  format?: string | null;
  displayType?: string | null;
  required: boolean;
  description?: string | null;
  ref?: string | null;
  itemsType?: string | null;
  itemsRef?: string | null;
  enum?: (string | number | boolean | null)[];
  example?: unknown;
  children?: UnifiedSchemaProperty[];
  childrenLabel?: string | null;
};

export type UnifiedSchema = {
  name: string;
  type?: string | null;
  format?: string | null;
  displayType?: string | null;
  description?: string | null;
  enum?: (string | number | boolean | null)[];
  example?: unknown;
  properties?: UnifiedSchemaProperty[];
  flatProperties?: UnifiedSchemaFlatProperty[];
  category?: 'request'|'response'|'object'|'enum';
};

export type UnifiedSchemaFlatProperty = {
  name: string;
  depth: number;
  type?: string | null;
  format?: string | null;
  displayType?: string | null;
  itemsType?: string | null;
  itemsRef?: string | null;
  required: boolean;
  description?: string | null;
  ref?: string | null;
  enum?: (string | number | boolean | null)[];
  example?: unknown;
  parentLabel?: string | null;
};

export type UnifiedEndpointParameter = {
  name: string;
  in: string;
  required: boolean;
  description?: string | null;
  schemaType?: string | null;
  schemaFormat?: string | null;
  schemaRef?: string | null;
  schemaDisplay?: string | null;
  example?: unknown;
  schemaExample?: unknown;
};

export type UnifiedMediaContent = {
  mediaType: string;
  schemaType?: string | null;
  schemaFormat?: string | null;
  schemaRef?: string | null;
  schemaDisplay?: string | null;
};

export type UnifiedEndpointResponse = {
  status: string;
  description?: string | null;
  content: UnifiedMediaContent[];
  headers?: UnifiedExampleHeader[];
  payloads?: UnifiedExamplePayload[];
  contents?: UnifiedContentSchema[];
};

export type UnifiedEndpointRequestBody = {
  required: boolean;
  description?: string | null;
  content: UnifiedMediaContent[];
  headers?: UnifiedExampleHeader[];
  payloads?: UnifiedExamplePayload[];
  contents?: UnifiedContentSchema[];
};

export type UnifiedEndpoint = {
  operationId?: string;
  method: string;
  path: string;
  summary?: string | null;
  description?: string | null;
  parameters?: UnifiedEndpointParameter[];
  requestBody?: UnifiedEndpointRequestBody | null;
  responses: UnifiedEndpointResponse[];
  security?: string[] | null;
  examples?: UnifiedEndpointExample | null;
  usageExamples?: UnifiedExampleUsageDoc[] | null;
};

export type UnifiedResource = {
  tag: string;
  summary?: string | null;
  endpoints: UnifiedEndpoint[];
};

export type UnifiedExampleHeader = {
  name: string;
  required: boolean;
  description?: string | null;
  example?: unknown;
};

export type UnifiedExamplePayload = {
  mediaType: string;
  example?: unknown;
};

export type UnifiedExampleUsageDoc = {
  description?: string | null;
  url: string;
  markdown?: string | null;
  text?: string | null;
};

export type UnifiedExampleResponse = {
  status: string;
  headers: UnifiedExampleHeader[];
  payloads: UnifiedExamplePayload[];
};

export type UnifiedContentSchema = {
  mediaType: string;
  schemaDef: any;
  schemaRef?: string | null;
};

export type UnifiedEndpointExample = {
  request?: {
    headers: UnifiedExampleHeader[];
    payloads: UnifiedExamplePayload[];
  } | null;
  successResponses: UnifiedExampleResponse[];
  errorResponses: UnifiedExampleResponse[];
};

export type UnifiedDoc = {
  meta: { title: string; version: string; date?: string | null; organization?: string | null; docsCode?: string | null };
  intro: { summary?: string | null; purpose?: string | null; audience?: string[] | null; terms?: { term: string; definition: string }[] | null };
  api_overview: {
    servers: { url: string; description?: string; env?: 'prod'|'test'|'dev'|null; host?: string | null }[];
    security: { scheme: string; description?: string; flows?: string[] | null }[];
    tags: { name: string; description?: string }[];
  };
  resources: UnifiedResource[];
  components: {
    schemas: UnifiedSchema[];
    enums: any[];
    groupedSchemas?: {
      request: UnifiedOperationSchema[];
      response: UnifiedOperationSchema[];
      object: UnifiedSchema[];
      enum: UnifiedSchema[];
    };
    nestedEnabled?: boolean;
  };
  compliance: { standards: any[]; security_controls: any[] };
  change_log: Array<{ version: string; date: string; changes: string[] }>
};

export type UnifiedOperationSchema = {
  id: string;
  method: string;
  path: string;
  summary?: string | null;
  status?: string | null;
  mediaType?: string | null;
  sourceName?: string | null;
  schema: UnifiedSchema;
};
