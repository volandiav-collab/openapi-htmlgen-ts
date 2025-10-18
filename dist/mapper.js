function detectEnv(u) {
    const url = (u || '').toLowerCase();
    if (/(prod|production)/.test(url))
        return 'prod';
    if (/(test|sandbox|stage)/.test(url))
        return 'test';
    if (/(dev|localhost)/.test(url))
        return 'dev';
    return null;
}
const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options']);
function refName(ref) {
    if (!ref)
        return null;
    const parts = ref.split('/');
    return parts[parts.length - 1] ?? null;
}
function decodeJsonPointerToken(token) {
    return token.replace(/~1/g, '/').replace(/~0/g, '~');
}
function resolveRef(spec, ref) {
    if (!ref || typeof ref !== 'string' || !ref.startsWith('#/'))
        return null;
    const tokens = ref.slice(2).split('/').map(decodeJsonPointerToken);
    let current = spec;
    for (const token of tokens) {
        if (current && typeof current === 'object' && token in current) {
            current = current[token];
        }
        else {
            return null;
        }
    }
    return current ?? null;
}
function slugify(parts) {
    return parts
        .filter((p) => !!p)
        .map(part => part
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''))
        .filter(Boolean)
        .join('-');
}
function pickExampleFromExamples(examples) {
    if (!examples || typeof examples !== 'object')
        return undefined;
    for (const example of Object.values(examples)) {
        if (example && typeof example === 'object') {
            if ('value' in example && example.value !== undefined)
                return example.value;
            if ('externalValue' in example && example.externalValue !== undefined)
                return example.externalValue;
        }
    }
    return undefined;
}
function pickSchemaExample(spec, schema) {
    if (!schema)
        return undefined;
    const resolved = resolveSchema(spec, schema);
    if (!resolved || typeof resolved !== 'object')
        return undefined;
    if ('example' in resolved && resolved.example !== undefined)
        return resolved.example;
    if ('default' in resolved && resolved.default !== undefined)
        return resolved.default;
    if (Array.isArray(resolved.enum) && resolved.enum.length)
        return resolved.enum[0];
    return undefined;
}
function extractHeaderExample(spec, header) {
    if (!header || typeof header !== 'object')
        return undefined;
    if ('example' in header && header.example !== undefined)
        return header.example;
    const fromExamples = pickExampleFromExamples(header.examples);
    if (fromExamples !== undefined)
        return fromExamples;
    if (header.schema) {
        const schemaExample = pickSchemaExample(spec, header.schema);
        if (schemaExample !== undefined)
            return schemaExample;
    }
    return undefined;
}
function extractSchemaMeta(spec, schema, seen = new Set()) {
    if (!schema || typeof schema !== 'object')
        return {};
    if (schema.$ref) {
        const ref = String(schema.$ref);
        const short = refName(ref);
        if (seen.has(ref)) {
            return { ref: short, displayType: short ?? undefined };
        }
        seen.add(ref);
        const resolved = resolveRef(spec, ref);
        if (!resolved) {
            return { ref: short, displayType: short ?? undefined };
        }
        const meta = extractSchemaMeta(spec, resolved, seen);
        if (!meta.ref)
            meta.ref = short;
        if (!meta.displayType)
            meta.displayType = short ?? undefined;
        return meta;
    }
    const meta = {
        type: schema.type ?? undefined,
        format: schema.format ?? undefined,
        enum: Array.isArray(schema.enum) ? schema.enum : undefined,
        example: schema.example
    };
    if (schema.type === 'array') {
        const itemMeta = extractSchemaMeta(spec, schema.items, new Set(seen));
        meta.itemsType = itemMeta.type ?? undefined;
        meta.itemsRef = itemMeta.ref ?? undefined;
        meta.displayType = itemMeta.ref
            ? `array<${itemMeta.ref}>`
            : itemMeta.type
                ? `array<${itemMeta.type}>`
                : 'array';
        if (!meta.type)
            meta.type = 'array';
        return meta;
    }
    if (schema.allOf || schema.oneOf || schema.anyOf) {
        const keyword = schema.allOf ? 'allOf' : schema.oneOf ? 'oneOf' : 'anyOf';
        meta.displayType = keyword;
        if (!meta.type)
            meta.type = 'object';
        return meta;
    }
    if (schema.properties || schema.additionalProperties) {
        if (!meta.type)
            meta.type = 'object';
        meta.displayType = meta.type;
        return meta;
    }
    if (meta.enum && meta.enum.length) {
        meta.displayType = `enum(${meta.enum.length})`;
        if (!meta.type)
            meta.type = 'enum';
        return meta;
    }
    if (schema.type === 'object') {
        meta.displayType = 'object';
        return meta;
    }
    if (meta.type) {
        meta.displayType = meta.format ? `${meta.type} (${meta.format})` : meta.type;
    }
    return meta;
}
function buildParameter(spec, param) {
    if (!param)
        return null;
    let resolved = param;
    if (param.$ref) {
        const refTarget = resolveRef(spec, param.$ref);
        if (!refTarget)
            return null;
        resolved = { ...refTarget, ...param };
        delete resolved.$ref;
    }
    if (!resolved?.name || !resolved?.in)
        return null;
    const schema = resolved.schema ?? null;
    const schemaMeta = extractSchemaMeta(spec, schema);
    const schemaExample = pickSchemaExample(spec, schema);
    const explicitExample = resolved.example ?? undefined;
    const fromExamples = pickExampleFromExamples(resolved.examples);
    const example = explicitExample ?? fromExamples ?? schemaExample;
    return {
        name: resolved.name,
        in: resolved.in,
        required: !!resolved.required,
        description: resolved.description ?? null,
        schemaType: schemaMeta.type ?? null,
        schemaFormat: schemaMeta.format ?? null,
        schemaRef: schemaMeta.ref ?? null,
        schemaDisplay: schemaMeta.displayType ?? null,
        example,
        schemaExample
    };
}
function dedupeParameters(params) {
    const seen = new Set();
    const result = [];
    for (const param of params) {
        const key = `${param.in}:${param.name}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        result.push(param);
    }
    return result;
}
function parameterToExampleHeader(param) {
    const example = param.example ?? param.schemaExample ?? undefined;
    return {
        name: param.name,
        required: param.required,
        description: param.description ?? null,
        example
    };
}
function buildMediaContent(spec, content) {
    const items = [];
    for (const [mediaType, def] of Object.entries(content ?? {})) {
        const schemaMeta = extractSchemaMeta(spec, def?.schema);
        items.push({
            mediaType,
            schemaType: schemaMeta.type ?? null,
            schemaFormat: schemaMeta.format ?? null,
            schemaRef: schemaMeta.ref ?? null,
            schemaDisplay: schemaMeta.displayType ?? null
        });
    }
    return items;
}
function buildExamplePayloads(spec, content) {
    const result = [];
    for (const [mediaType, def] of Object.entries(content ?? {})) {
        const payloadExample = (def && typeof def === 'object' && 'example' in def && def.example !== undefined)
            ? def.example
            : pickExampleFromExamples(def?.examples);
        const schemaExample = pickSchemaExample(spec, def?.schema);
        result.push({
            mediaType,
            example: payloadExample ?? schemaExample
        });
    }
    return result;
}
function buildResponseHeaders(spec, headers) {
    const result = [];
    for (const [name, header] of Object.entries(headers ?? {})) {
        let resolved = header;
        if (header?.$ref) {
            const refTarget = resolveRef(spec, header.$ref);
            if (refTarget) {
                resolved = { ...refTarget, ...header };
                delete resolved.$ref;
            }
        }
        result.push({
            name,
            required: !!resolved?.required,
            description: resolved?.description ?? null,
            example: extractHeaderExample(spec, resolved)
        });
    }
    return result;
}
function mergeExampleHeaders(...lists) {
    const result = [];
    const seen = new Set();
    for (const list of lists) {
        for (const header of list ?? []) {
            const key = header.name.toLowerCase();
            if (seen.has(key))
                continue;
            seen.add(key);
            result.push(header);
        }
    }
    return result;
}
function dedupeOperationSchemas(schemas) {
    const map = new Map();
    for (const schema of schemas) {
        if (!map.has(schema.id)) {
            map.set(schema.id, schema);
        }
    }
    return Array.from(map.values());
}
function createOperationSchema(opts) {
    const { spec, kind, method, path, schemaDef, mediaType, summary, status, includeNested } = opts;
    if (!schemaDef)
        return null;
    const upperMethod = method.toUpperCase();
    let sourceName = refName(schemaDef?.$ref ?? null);
    if (!sourceName && typeof schemaDef?.title === 'string') {
        sourceName = schemaDef.title;
    }
    const baseParts = [`${upperMethod} ${path}`];
    if (kind === 'request') {
        baseParts.push('— Запрос');
    }
    else {
        if (status) {
            baseParts.push(`— ${status}`);
        }
        baseParts.push('— Ответ');
    }
    const baseLabel = baseParts.join(' ').replace(/\s+/g, ' ').trim();
    const label = mediaType ? `${baseLabel} (${mediaType})` : baseLabel;
    const schemaName = sourceName ?? label;
    const schema = buildUnifiedSchema(spec, schemaName, schemaDef, includeNested);
    const id = slugify(['schema', kind, upperMethod, path, status, mediaType]) || slugify(['schema', baseLabel]);
    return {
        id: id || slugify(['schema', upperMethod, path]),
        method: upperMethod,
        path,
        summary: summary ?? null,
        status: status ?? null,
        mediaType,
        sourceName,
        schema
    };
}
function buildRequestBody(spec, requestBody) {
    if (!requestBody)
        return null;
    let resolved = requestBody;
    if (requestBody.$ref) {
        const refTarget = resolveRef(spec, requestBody.$ref);
        if (!refTarget)
            return null;
        resolved = { ...refTarget, ...requestBody };
        delete resolved.$ref;
    }
    const content = buildMediaContent(spec, resolved.content);
    const payloads = buildExamplePayloads(spec, resolved.content);
    const contents = Object.entries(resolved?.content ?? {}).reduce((acc, [mediaType, def]) => {
        if (def?.schema) {
            acc.push({ mediaType, schemaDef: def.schema, schemaRef: refName(def.schema.$ref ?? null) });
        }
        return acc;
    }, []);
    return {
        required: !!resolved.required,
        description: resolved.description ?? null,
        content,
        headers: buildResponseHeaders(spec, resolved?.headers),
        payloads,
        contents: contents.length ? contents : undefined
    };
}
function buildResponses(spec, responses) {
    const result = [];
    for (const [status, definition] of Object.entries(responses ?? {})) {
        let resolved = definition;
        if (definition?.$ref) {
            const refTarget = resolveRef(spec, definition.$ref);
            if (refTarget) {
                resolved = { ...refTarget, ...definition };
                delete resolved.$ref;
            }
        }
        const content = buildMediaContent(spec, resolved?.content);
        const payloads = buildExamplePayloads(spec, resolved?.content);
        const contents = Object.entries(resolved?.content ?? {}).reduce((acc, [mediaType, def]) => {
            if (def?.schema) {
                acc.push({ mediaType, schemaDef: def.schema, schemaRef: refName(def.schema.$ref ?? null) });
            }
            return acc;
        }, []);
        result.push({
            status,
            description: resolved?.description ?? null,
            content,
            headers: buildResponseHeaders(spec, resolved?.headers),
            payloads,
            contents: contents.length ? contents : undefined
        });
    }
    return result;
}
function mergeRequired(...lists) {
    const set = new Set();
    for (const list of lists) {
        for (const item of list ?? []) {
            if (typeof item === 'string')
                set.add(item);
        }
    }
    return Array.from(set);
}
function mergeProperties(target, source) {
    for (const [name, schema] of Object.entries(source ?? {})) {
        if (!(name in target)) {
            target[name] = schema;
        }
    }
}
function resolveSchema(spec, schema, stack = new Set()) {
    if (!schema || typeof schema !== 'object')
        return schema;
    if (stack.has(schema))
        return schema;
    stack.add(schema);
    let base = schema;
    if (schema.$ref) {
        const refTarget = resolveRef(spec, schema.$ref);
        if (refTarget) {
            base = { ...refTarget, ...schema };
            delete base.$ref;
        }
    }
    if (base.allOf) {
        const combined = { ...base };
        delete combined.allOf;
        const properties = { ...combined.properties };
        let required = Array.isArray(combined.required) ? [...combined.required] : [];
        let enumValues = Array.isArray(combined.enum) ? [...combined.enum] : null;
        for (const item of base.allOf ?? []) {
            const resolvedItem = resolveSchema(spec, item, new Set(stack));
            if (resolvedItem?.properties) {
                mergeProperties(properties, resolvedItem.properties);
            }
            required = mergeRequired(required, resolvedItem?.required);
            combined.description ??= resolvedItem?.description;
            if (resolvedItem?.type && !combined.type) {
                combined.type = resolvedItem.type;
            }
            if (resolvedItem?.format && !combined.format) {
                combined.format = resolvedItem.format;
            }
            if (resolvedItem?.items && !combined.items) {
                combined.items = resolvedItem.items;
            }
            if (resolvedItem?.example !== undefined && combined.example === undefined) {
                combined.example = resolvedItem.example;
            }
            if (Array.isArray(resolvedItem?.enum) && resolvedItem.enum.length) {
                enumValues ??= [];
                for (const value of resolvedItem.enum) {
                    if (!enumValues.some(existing => existing === value)) {
                        enumValues.push(value);
                    }
                }
            }
        }
        if (Object.keys(properties).length) {
            combined.properties = properties;
        }
        if (required.length) {
            combined.required = required;
        }
        if (enumValues && enumValues.length) {
            combined.enum = enumValues;
        }
        return combined;
    }
    return base;
}
function buildSchemaProperty(spec, name, schema, parentRequired, includeNested) {
    const resolved = resolveSchema(spec, schema);
    const meta = extractSchemaMeta(spec, resolved);
    const required = parentRequired.has(name);
    const property = {
        name,
        type: meta.type ?? null,
        format: meta.format ?? null,
        displayType: meta.displayType ?? null,
        required,
        description: resolved?.description ?? null,
        ref: meta.ref ?? null,
        itemsType: meta.itemsType ?? null,
        itemsRef: meta.itemsRef ?? null,
        enum: meta.enum,
        example: resolved?.example
    };
    const children = [];
    if (includeNested && resolved?.properties) {
        const childRequired = new Set(resolved.required ?? []);
        for (const [childName, childSchema] of Object.entries(resolved.properties)) {
            children.push(buildSchemaProperty(spec, childName, childSchema, childRequired, includeNested));
        }
    }
    if (includeNested && resolved?.items && resolved.type === 'array') {
        const childRequired = new Set();
        children.push(buildSchemaProperty(spec, '[item]', resolved.items, childRequired, includeNested));
        property.childrenLabel = 'items';
    }
    if (children.length) {
        property.children = children;
        if (!property.childrenLabel) {
            property.childrenLabel = 'properties';
        }
    }
    return property;
}
function flattenSchemaProperties(properties, depth = 0, parentLabel = null) {
    const result = [];
    for (const prop of properties ?? []) {
        result.push({
            name: prop.name,
            depth,
            type: prop.type ?? null,
            format: prop.format ?? null,
            displayType: prop.displayType ?? null,
            itemsType: prop.itemsType ?? null,
            itemsRef: prop.itemsRef ?? null,
            required: prop.required,
            description: prop.description ?? null,
            ref: prop.ref ?? null,
            enum: prop.enum,
            example: prop.example,
            parentLabel
        });
        if (prop.children?.length) {
            result.push(...flattenSchemaProperties(prop.children, depth + 1, prop.childrenLabel ?? null));
        }
    }
    return result;
}
function buildUnifiedSchema(spec, name, schema, includeNested) {
    const resolved = resolveSchema(spec, schema);
    const meta = extractSchemaMeta(spec, resolved);
    const required = new Set(resolved?.required ?? []);
    const properties = [];
    for (const [propName, propSchema] of Object.entries(resolved?.properties ?? {})) {
        properties.push(buildSchemaProperty(spec, propName, propSchema, required, includeNested));
    }
    const flatProperties = flattenSchemaProperties(properties);
    return {
        name,
        type: meta.type ?? null,
        format: meta.format ?? null,
        displayType: meta.displayType ?? null,
        description: resolved?.description ?? null,
        enum: meta.enum,
        example: resolved?.example,
        properties: properties.length ? properties : undefined,
        flatProperties: flatProperties.length ? flatProperties : undefined
    };
}
function categorizeSchema(_name, schema) {
    if (Array.isArray(schema.enum) && schema.enum.length) {
        return 'enum';
    }
    return 'object';
}
export function mapToUnified(spec, options = {}) {
    const info = spec?.info ?? {};
    const servers = spec?.servers ?? [];
    const tags = Array.isArray(spec?.tags) ? spec.tags : [];
    const includeNested = options?.includeNested === true;
    const tagDescriptions = new Map();
    for (const tag of tags) {
        if (tag?.name) {
            tagDescriptions.set(tag.name, tag);
        }
    }
    const unified = {
        meta: { title: info.title ?? 'API', version: info.version ?? '0.0.0', date: null, organization: null, docsCode: null },
        intro: { summary: info.description ?? null, purpose: null, audience: null, terms: null },
        api_overview: {
            servers: servers.map(s => ({ url: s.url, description: s.description, env: detectEnv(s.url) })),
            security: [],
            tags
        },
        resources: [],
        components: { schemas: [], enums: [], groupedSchemas: undefined },
        compliance: { standards: [], security_controls: [] },
        change_log: []
    };
    const requestOperationSchemas = [];
    const responseOperationSchemas = [];
    const secSchemes = spec?.components?.securitySchemes ?? {};
    for (const [name, scheme] of Object.entries(secSchemes)) {
        unified.api_overview.security.push({
            scheme: scheme.type,
            description: scheme.description,
            flows: scheme.type === 'oauth2' ? Object.keys(scheme.flows ?? {}) : null
        });
    }
    const byTag = {};
    for (const [p, methods] of Object.entries(spec?.paths ?? {})) {
        const pathItemParams = Array.isArray(methods?.parameters) ? methods.parameters : [];
        for (const [m, op] of Object.entries(methods ?? {})) {
            if (!HTTP_METHODS.has(m))
                continue;
            const tag = (op.tags?.[0]) ?? 'untagged';
            const tagInfo = tagDescriptions.get(tag);
            const group = (byTag[tag] ||= { tag, summary: tagInfo?.description ?? null, endpoints: [] });
            if (!group.summary && tagInfo?.description) {
                group.summary = tagInfo.description;
            }
            const opParams = Array.isArray(op.parameters) ? op.parameters : [];
            const allParams = [];
            for (const param of [...pathItemParams, ...opParams]) {
                const built = buildParameter(spec, param);
                if (built) {
                    allParams.push(built);
                }
            }
            const dedupedParams = dedupeParameters(allParams);
            const ep = {
                operationId: op.operationId,
                method: m.toUpperCase(),
                path: p,
                summary: op.summary,
                description: op.description,
                parameters: dedupedParams,
                requestBody: undefined,
                responses: [],
                security: (op.security?.map((s) => Object.keys(s)?.[0])) ?? null,
                examples: null
            };
            ep.requestBody = buildRequestBody(spec, op.requestBody);
            ep.responses = buildResponses(spec, op.responses);
            const parameterHeaders = dedupedParams
                .filter(param => param.in === 'header')
                .map(parameterToExampleHeader);
            const requestHeaders = mergeExampleHeaders(parameterHeaders, ep.requestBody?.headers);
            const requestPayloads = ep.requestBody?.payloads ?? [];
            const hasRequestPayload = requestPayloads.some(payload => payload.example !== undefined);
            const hasRequestHeaders = requestHeaders.length > 0;
            const requestExample = (hasRequestHeaders || hasRequestPayload)
                ? { headers: requestHeaders, payloads: requestPayloads }
                : null;
            const responseExamples = ep.responses.map((resp) => ({
                status: resp.status,
                headers: resp.headers ?? [],
                payloads: resp.payloads ?? []
            }));
            ep.examples = {
                request: requestExample,
                responses: responseExamples
            };
            if (ep.requestBody?.contents) {
                for (const item of ep.requestBody.contents) {
                    const operationSchema = createOperationSchema({
                        spec,
                        kind: 'request',
                        method: ep.method,
                        path: ep.path,
                        schemaDef: item.schemaDef,
                        mediaType: item.mediaType,
                        summary: op.summary ?? null,
                        includeNested
                    });
                    if (operationSchema) {
                        requestOperationSchemas.push(operationSchema);
                    }
                }
            }
            for (const resp of ep.responses) {
                if (!resp.contents)
                    continue;
                for (const item of resp.contents) {
                    const operationSchema = createOperationSchema({
                        spec,
                        kind: 'response',
                        method: ep.method,
                        path: ep.path,
                        schemaDef: item.schemaDef,
                        mediaType: item.mediaType,
                        summary: op.summary ?? null,
                        status: resp.status,
                        includeNested
                    });
                    if (operationSchema) {
                        responseOperationSchemas.push(operationSchema);
                    }
                }
            }
            group.endpoints.push(ep);
        }
    }
    unified.resources = Object.values(byTag);
    const uniqueRequestSchemas = dedupeOperationSchemas(requestOperationSchemas);
    const uniqueResponseSchemas = dedupeOperationSchemas(responseOperationSchemas);
    const schemaGroups = {
        request: uniqueRequestSchemas,
        response: uniqueResponseSchemas,
        object: [],
        enum: []
    };
    for (const [name, s] of Object.entries(spec?.components?.schemas ?? {})) {
        if (Array.isArray(s.enum)) {
            const enumDescriptions = Array.isArray(s['x-enum-descriptions'])
                ? s['x-enum-descriptions']
                : null;
            const schemaDescription = typeof s.description === 'string' ? s.description : null;
            const hasHtmlTable = !!schemaDescription && /<table\b/i.test(schemaDescription);
            unified.components.enums.push({
                name,
                description: schemaDescription,
                renderValuesTable: !hasHtmlTable,
                values: s.enum.map((v, index) => ({
                    name: String(v),
                    value: v,
                    description: hasHtmlTable ? null : enumDescriptions?.[index] ?? null
                }))
            });
        }
        const schema = buildUnifiedSchema(spec, name, s, includeNested);
        const category = categorizeSchema(name, schema);
        schema.category = category === 'enum' ? 'enum' : 'object';
        unified.components.schemas.push(schema);
        if (schema.category === 'enum') {
            schemaGroups.enum.push(schema);
        }
        else {
            schemaGroups.object.push(schema);
        }
    }
    unified.components.groupedSchemas = schemaGroups;
    unified.components.nestedEnabled = includeNested;
    return unified;
}
