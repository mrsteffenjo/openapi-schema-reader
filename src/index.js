import './style.css';

async function resolv(acc, base, path, schema, id) {
    const sourceKey = schema;
    // const sourceItemKey = sourceKey + id;
    acc = acc ? acc : { classes: [], links: [], sources: {}, items: {} };
    let source = acc.sources[sourceKey];
    if (!source) {
        const url = new URL(path + schema, base);
        console.log('GET', url.href);
        source = await fetch(url).then(res => res.json())
        acc.sources[sourceKey] = source;
    }

    let item = acc.items[sourceKey];
    if (!item) {
        item = Object.getOwnPropertyNames(source.definitions)
            .map(name => {
                let def = source.definitions[name]
                def.name = name
                return def
            })
            .find(d => d.$id === id)
        acc.items[sourceKey] = item;
    }

    const properties = Object.getOwnPropertyNames(item.properties)
        .map(p => {
            let prop = item.properties[p];
            prop.name = p;
            return prop;
        });
    const attributes = properties.filter(p => !isLink(p));
    const links = properties.filter(p => isLink(p));
    if (!acc.classes.some(c => c.name === item.name)) {
        acc.classes.push({
            name: item.name,
            attributes: attributes.map(a => `  + ${a.name}: ${a.format?a.type+' ('+a.format+')':a.type}\n`)
        });
    }

    for (let i = 0; i < links.length; i++) {
        const l = links[i];
        const ref = (l.type && l.type === 'array') ? l.items.$ref : l.$ref;
        const idIdx = ref.lastIndexOf('#');
        const defIdPart = ref.substring(idIdx);

        const idx = ref.lastIndexOf('/');
        const subpath = path + ref.substring(0, idx + 1);
        const file = ref.substring(idx + 1);
        await resolv(acc, base, subpath, file, defIdPart)

        acc.links.push(`"${item.name}" --> "${defIdPart}": ${l.name}\n`);
    }

    return acc;
}

function isLink(prop) {
    return prop.$ref || (prop.type === 'array' && prop.items.$ref)
}

async function getTargetDefenition(baseUrl, schema, defId) {
    const definitions = Object.getOwnPropertyNames(schema.definitions)
        .map(name => {
            let def = schema.definitions[name]
            def.name = name
            return def
        });

    const definition = definitions.find(d => d.$id === defId);
    const properties = Object.getOwnPropertyNames(definition.properties)
        .map(p => {
            let prop = definition.properties[p];
            prop.name = p;
            return prop;
        });
    const attributes = properties.filter(p => !isLink(p));
    const links = properties.filter(p => isLink(p));


    let str = '';
    for (const link of links) {
        const ref = (link.type && link.type === 'array') ? link.items.$ref : link.$ref;
        const idx = ref.lastIndexOf('#');
        const schemaPart = ref.substring(ref.startsWith('..') ? 3 : 0, idx);
        const defIdPart = ref.substring(idx);
        const refSchema = await getSchema(baseUrl, schemaPart, defIdPart);
        str += getTargetDefenition(baseUrl, refSchema, defIdPart);
    }

    str += `class ${definition.name} {\n`
    attributes.forEach(attr => str += `  + ${attr.name}: ${attr.format?attr.type+' ('+attr.format+')':attr.type}\n`)
    str += `}\n\n`


    return str
}

function findDefinition() {
    const baseUrl = new URL(document.getElementById('baseUrl').value);
    const schemaFile = document.getElementById('schema').value;
    const defId = document.getElementById('definitionId').value;

    const idx = schemaFile.lastIndexOf('/');
    const path = schemaFile.substring(0, idx + 1);
    const file = schemaFile.substring(idx + 1);
    resolv(null, baseUrl.href, path, file + defId, defId).then(res => {
        console.log(res)
        let str = '@startuml ' + schemaFile + '\n';
        res.classes.forEach(c => {
            str += `class ${c.name} {\n`
            c.attributes.forEach(attr => str += attr)
            str += `}\n\n`
        })
        res.links.forEach(l => str += l)
        str += 'hide empty members\n@enduml'

        let pre = document.createElement('pre');
        pre.innerText = str;
        document.body.appendChild(pre);
    });

    // getSchema(baseUrl, schemaFile, defId)
    //     .then(schema => {
    //         let pre = document.createElement('pre');
    //         pre.innerText = getTargetDefenition(baseUrl, schema, defId); //JSON.stringify({ $id, title }, null, 2)
    //         document.body.appendChild(pre);
    //     });
}

async function getSchema(baseUrl, schema, defId) {
    let url = new URL(baseUrl.pathname + schema, baseUrl);
    console.log('GET', url.href);
    return fetch(url)
        .then(res => res.json())
}

document.getElementById('go').addEventListener('click', (e) => {
    findDefinition();
});