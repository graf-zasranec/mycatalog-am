#!/usr/bin/env python3
"""Refresh local Graphify components and atomically publish shared context.

Code extraction is local. Reviewed document fragments and source hashes must be
refreshed by an assistant after document changes. Publication refuses stale
sources. Generated graph outputs are local development context, not site assets.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

CATALOGUE = Path(__file__).resolve().parents[1]
MARKETING = CATALOGUE.parent / 'Marketing Better.am'
COMPONENTS = {
    'catalogue': (CATALOGUE, 'catalogue-code.json', 'catalogue-semantic.json', 'catalogue-semantic-sources.json'),
    'marketing': (MARKETING, 'code-graph.json', '.graphify_semantic.json', 'semantic-sources.json'),
}

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.partial')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)

def links(data):
    return data.get('links', data.get('edges', []))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def stale_sources(root, manifest):
    return [name for name, digest in read(manifest).items()
            if not (root / name).is_file() or sha(root / name) != digest]

def refresh_code(selected=None):
    from graphify.detect import detect
    from graphify.extract import collect_files, extract
    catalogue_files = collect_files(CATALOGUE / 'tools', root=CATALOGUE)
    for pattern in ['*.mjs', '*.js', '*.py']:
        catalogue_files.extend(CATALOGUE.glob(pattern))
    worker = CATALOGUE / 'cloudflare/worker'
    if worker.is_dir():
        catalogue_files.extend(collect_files(worker, root=CATALOGUE))
    scope = CATALOGUE / 'graphify-out/DESIGN-SCOPE.json'
    if scope.is_file():
        catalogue_files.extend(Path(p) for p in read(scope).get('files', {}).get('code', []) if Path(p).is_file())
    catalogue_files = sorted({p for p in catalogue_files if p.is_file() and not any(
        part in ('node_modules', 'graphify-out', '.git') for part in p.parts)})
    marketing_files = []
    if selected == 'marketing':
        detected = detect(MARKETING)
        marketing_files = [Path(p) for p in detected.get('files', {}).get('code', [])
                           if Path(p).name not in ('ledger.json', 'video-state.json', 'render-outputs.json')]
    for tag, root, files, output in [
        ('catalogue', CATALOGUE, catalogue_files, 'catalogue-code.json'),
        ('marketing', MARKETING, marketing_files, 'code-graph.json'),
    ]:
        if tag != selected:
            continue
        if not files:
            raise RuntimeError(f'No code files detected for {tag}; existing graph preserved')
        print(f'{tag}: extracting {len(files)} code files', flush=True)
        data = extract(files, root=root, cache_root=root, max_workers=8)
        if not data.get('nodes'):
            raise RuntimeError(f'Empty {tag} code extraction; existing graph preserved')
        write(root / 'graphify-out' / output, data)
        write(root / 'graphify-out/code-sources.json', {str(p.relative_to(root)): sha(p) for p in files})

def component(tag, root, code_name, semantic_name, hashes_name):
    directory = root / 'graphify-out'
    code = read(directory / code_name)
    semantic = read(directory / semantic_name)
    nodes = {n['id']: dict(n) for n in code['nodes']}
    for node in semantic['nodes']:
        node = dict(node)
        node['_origin'] = 'semantic'
        # Graphify treats rationale as independently attributed doc evidence;
        # retain the extracted explanation instead of folding it into an AST file.
        if node.get('description') and not node.get('rationale'):
            node['rationale'] = node['description']
        nodes[node['id']] = node
    result = {'nodes': list(nodes.values()), 'edges': links(code) + links(semantic),
              'hyperedges': semantic.get('hyperedges', [])}
    invalid = []
    for node in result['nodes']:
        source = node.get('source_file')
        if not source:
            continue
        path = root / source
        if not path.is_file():
            # Some AST external module references carry pseudo source paths.
            if node.get('_origin') != 'semantic':
                node['external_reference'] = source
                node.pop('source_file', None)
            else:
                invalid.append(source)
    if invalid:
        raise RuntimeError(f'{tag} semantic nodes reference missing files: {sorted(set(invalid))}')
    ids = set(nodes)
    external = {}
    for edge in result['edges']:
        if edge['source'] not in ids:
            raise RuntimeError(f'{tag}: missing relationship source {edge}')
        if edge['target'] not in ids:
            if edge.get('_origin') != 'ast' or edge.get('relation') not in ('imports', 'imports_from', 'calls'):
                raise RuntimeError(f'{tag}: unresolved semantic target {edge}')
            # The AST explicitly names an imported/external dependency but has
            # no implementation node. Preserve the evidence without implying
            # that its implementation or cross-module resolution was indexed.
            target = edge['target']
            external[target] = {'id': target, 'label': 'External reference: ' + target,
                'file_type': 'concept', '_origin': 'ast', 'external_reference': True,
                'resolution_status': 'Implementation not indexed; verify the cited import/call source.',
                'source_file': edge.get('source_file'), 'source_location': edge.get('source_location')}
            edge['resolution_status'] = 'external_or_unresolved_target'
    result['nodes'].extend(external.values())
    for node in result['nodes']:
        if node.get('external_reference') and not node.get('source_file'):
            evidence = next((e for e in result['edges'] if e['target'] == node['id'] and e.get('source_file') and (root / e['source_file']).is_file()), None)
            if evidence:
                node['source_file'] = evidence['source_file']
                node['source_location'] = evidence.get('source_location')
    return result

def render(root, extraction, coverage):
    from graphify.build import build_from_json
    from graphify.cluster import cluster, score_all
    from graphify.analyze import god_nodes, surprising_connections, suggest_questions
    from graphify.export import to_json, to_html
    from graphify.report import generate
    version = importlib.metadata.version('graphifyy')
    graph = build_from_json(extraction, directed=False, dedup=False)
    expected = {n['id'] for n in extraction['nodes']}
    if set(graph) != expected:
        raise RuntimeError(f'Build changed identities; added={sorted(set(graph)-expected)[:12]}, removed={sorted(expected-set(graph))[:12]}; refusing publication')
    communities = cluster(graph)
    scores = score_all(graph, communities)
    labels = {cid: 'Community ' + str(cid) for cid in communities}
    gods = god_nodes(graph)
    surprises = surprising_connections(graph, communities)
    questions = suggest_questions(graph, communities, labels)
    output = root / 'graphify-out'
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.graphify-publish-', dir=output) as stage_name:
        stage = Path(stage_name)
        if not to_json(graph, communities, str(stage / 'graph.json')):
            raise RuntimeError('Graph export refused')
        exported = read(stage / 'graph.json')
        exported.setdefault('graph', {}).update({'graphify_version': version, 'coverage': coverage})
        write(stage / 'graph.json', exported)
        report = generate(graph, communities, scores, labels, gods, surprises,
                          {'warning': coverage}, {'input': 0, 'output': 0}, str(root), suggested_questions=questions)
        report += ('\n\n## Freshness and cost\n\nSource hashes were checked before publication. '
                   'Semantic extraction used the host assistant; exact token cost is unavailable. '
                   'Any zero above covers local code extraction only. Media binaries and generated catalogue data '
                   'are excluded. Historical campaign claims require current retailer verification. '
                   'External dependency placeholders are explicitly unresolved; verify imports/calls against source. All raw relationships and parallel edges are retained in RAW_EXTRACTION.json.\n')
        (stage / 'GRAPH_REPORT.md').write_text(report, encoding='utf-8')
        write(stage / 'RAW_EXTRACTION.json', extraction)
        if len(expected) <= 5000:
            to_html(graph, communities, str(stage / 'graph.html'), community_labels=labels)
        else:
            print(f'Warning: {len(expected)} nodes; visualization skipped above 5000-node limit')
        write(stage / '.graphify_analysis.json', {'communities': communities, 'cohesion': scores,
              'gods': gods, 'surprises': surprises, 'questions': questions})
        for path in stage.iterdir():
            path.replace(output / path.name)
    return {'nodes': graph.number_of_nodes(), 'edges': graph.number_of_edges(),
            'external_reference_nodes': sum(bool(n.get('external_reference')) for n in extraction['nodes'])}

def new_marketing_documents():
    tracked = set(read(MARKETING / 'graphify-out/semantic-sources.json'))
    found = set()
    for folder, dirs, files in os.walk(MARKETING):
        dirs[:] = [name for name in dirs if name not in (
            'node_modules', 'graphify-out', 'archive', 'assets', 'qa',
            '.hyperframes', '.git', 'research', 'renders')]
        for name in files:
            path = Path(folder) / name
            if path.suffix.lower() in ('.md', '.txt'):
                found.add(str(path.relative_to(MARKETING)))
    return sorted(found - tracked)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh-code', action='store_true')
    parser.add_argument('--extract-component', choices=['catalogue', 'marketing'], help=argparse.SUPPRESS)
    parser.add_argument('--code-only', action='store_true', help='Refresh components without publishing')
    args = parser.parse_args()
    if args.extract_component:
        refresh_code(args.extract_component)
        return
    if args.refresh_code or args.code_only:
        for tag in COMPONENTS:
            subprocess.run([sys.executable, str(Path(__file__).resolve()), '--extract-component', tag], check=True)
    if args.code_only:
        return
    stale = {}
    for tag, (root, _, _, manifest) in COMPONENTS.items():
        changed = stale_sources(root, root / 'graphify-out' / manifest)
        changed_code = stale_sources(root, root / 'graphify-out/code-sources.json')
        if changed or changed_code:
            stale[tag] = {'documents': changed, 'code': changed_code}
    new_documents = new_marketing_documents()
    if new_documents:
        stale.setdefault('marketing', {})['new_documents'] = new_documents
    if stale:
        raise RuntimeError('Stale sources; existing published graphs preserved: ' + json.dumps(stale))
    parts = {tag: component(tag, *details) for tag, details in COMPONENTS.items()}
    shared = {'nodes': [], 'edges': [], 'hyperedges': []}
    for tag, part in parts.items():
        root = COMPONENTS[tag][0]
        for original in part['nodes']:
            node = dict(original)
            node['id'] = f"{tag}::{node['id']}"
            node['repo'] = tag
            if node.get('source_file'):
                node['source_file'] = str((root / node['source_file']).resolve())
            shared['nodes'].append(node)
        for original in part['edges']:
            edge = dict(original)
            for endpoint in ['source', 'target']:
                edge[endpoint] = f'{tag}::{edge[endpoint]}'
            if edge.get('source_file'):
                edge['source_file'] = str((root / edge['source_file']).resolve())
            shared['edges'].append(edge)
        for original in part['hyperedges']:
            hyper = dict(original)
            hyper['id'] = f"{tag}::{hyper.get('id', 'group')}"
            hyper['nodes'] = [f'{tag}::{n}' for n in hyper.get('nodes', [])]
            shared['hyperedges'].append(hyper)
        workspace = f'{tag}::workspace'
        shared['nodes'].append({'id': workspace, 'label': f'Better.am {tag} workspace',
             'file_type': 'concept', '_origin': 'semantic', 'repo': tag,
             'source_file': str(root / 'AGENTS.md'), 'source_location': 'L1'})
        # Connect documentary policy/file entities, not every function in a file.
        for node in shared['nodes'][:]:
            if node.get('repo') == tag and node['id'] != workspace and node.get('_origin') == 'semantic' and Path(node.get('source_file', '')).name in ('AGENTS.md', 'CAMPAIGN-RULES.md', 'PHOTO_PIPELINE.md'):
                shared['edges'].append({'source': workspace, 'target': node['id'], 'relation': 'contains',
                    'confidence': 'EXTRACTED', 'confidence_score': 1.0,
                    'source_file': str(root / 'AGENTS.md')})
    shared['edges'].append({'source': 'marketing::workspace', 'target': 'catalogue::workspace',
        'relation': 'uses_catalogue_assets_and_data', 'confidence': 'EXTRACTED',
        'confidence_score': 1.0, 'source_file': str(MARKETING / 'AGENTS.md'), 'source_location': 'L10'})
    stats = {'marketing': render(MARKETING, parts['marketing'], 'Current marketing code and reviewed campaign documents.'),
             'shared': render(CATALOGUE, shared, 'Combined current catalogue code/design/photo context and marketing campaigns. Tools-only output must not replace this graph.')}
    stats['semantic_stale_files'] = 0
    stats['graphify_version'] = importlib.metadata.version('graphifyy')
    write(CATALOGUE / 'graphify-out/merge-audit.json', stats)
    print(json.dumps(stats, indent=2))

if __name__ == '__main__':
    interpreter = CATALOGUE / 'graphify-out/.graphify_python'
    if interpreter.is_file() and Path(sys.executable).resolve() != Path(interpreter.read_text().strip()).resolve():
        raise SystemExit(subprocess.call([interpreter.read_text().strip(), str(Path(__file__).resolve()), *sys.argv[1:]]))
    main()
