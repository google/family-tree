# Family Tree Web App

An interactive genealogical visualization and exploration application built with React, SVG, and Tailwind CSS.

## Features

- **Automated Relationship & Generational Deduction**: Reconstructs complete multi-generational family trees from CSV/spreadsheets, inferring birth years, parent-child links, and spousal relationships.
- **Dynamic Tree Layout**: Renders clean, collision-free family trees with non-crossing multi-spouse positioning, chronological sibling ordering, and maternal drop-stem connectors.
- **Search & Navigation**: Real-time fuzzy and semantic search across individuals, places, occupations, and relationships.
- **Map & Timeline Views**: Interactive geographical mapping of ancestral locations and generational timelines.
- **Zero Build Step**: Native ES module architecture loaded via Babel Standalone in the browser for instant development and modification.

## Quick Start

1. Start the local development server:
   ```bash
   ./start_server.sh 8000
   # or: python3 server.py 8000
   ```

2. Open the application in your browser:
   [http://localhost:8000/](http://localhost:8000/)

## Directory Structure

- `App.jsx`: Core React application component containing genealogical domain models, graph layout algorithms, canvas rendering, search, and UI panels.
- `index.html`: Web entry point configuring Tailwind CSS, fonts, and mounting the root application component.
- `server.py`: Lightweight Python HTTP development server configured with zero-caching and proper MIME types for `.jsx` modules.
- `start_server.sh`: Shell launcher script for `server.py`.
- `tests.html`: Test suite covering edge cases, kinship inference, and tree layout scenarios.

## Running Tests & Quality Checks

### In the Browser
Start the server and open the test suite in your browser:
[http://localhost:8000/tests.html](http://localhost:8000/tests.html)

### Via Automated CLI (Node.js)
```bash
# Fast slice: run a single test section in <1s
node scripts/run_tests.mjs --section 188

# Fast gate: run all 2,242 algorithmic unit tests + AST checks (~3s)
node scripts/run_tests.mjs --fast

# Full gate: run all 4 stages including Headless Chrome E2E test (~20s)
node scripts/run_tests.mjs --full

# Code quality audit (40-line limit, JSDoc coverage, examples, scope check)
node scripts/audit_quality.mjs
```

See [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) for detailed architecture, test slicing options, and development practices.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the Apache 2.0 License. See [LICENSE](LICENSE) for details.
