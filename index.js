const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());


const USER_ID = "Darshan Govindaraj_24042026";      
const EMAIL_ID = "dg0230@srmist.edu.in";  
const ROLL_NUMBER = "RA2311043010077";           


const VALID_EDGE = /^[A-Z]->[A-Z]$/;

function parseData(data) {
  const invalid_entries = [];
  const duplicate_edges = [];
  const seenEdges = new Set();
  const validEdges = [];

  for (let raw of data) {
    const entry = typeof raw === "string" ? raw.trim() : String(raw).trim();

    
    if (!VALID_EDGE.test(entry)) {
      invalid_entries.push(raw); // push original
      continue;
    }

    const [parent, child] = entry.split("->"); 

    
    if (parent === child) {
      invalid_entries.push(raw);
      continue;
    }

    if (seenEdges.has(entry)) {
      
      if (!duplicate_edges.includes(entry)) duplicate_edges.push(entry);
      continue;
    }

    seenEdges.add(entry);
    validEdges.push({ parent, child, edge: entry });
  }

  return { validEdges, invalid_entries, duplicate_edges };
}

function buildHierarchies(validEdges) {
  
  const childParentMap = new Map(); 
  const adjacency = new Map();      

  for (const { parent, child } of validEdges) {
    if (childParentMap.has(child)) continue; 
    childParentMap.set(child, parent);

    if (!adjacency.has(parent)) adjacency.set(parent, []);
    adjacency.get(parent).push(child);
  }


  const allNodes = new Set();
  for (const { parent, child } of validEdges) {
    allNodes.add(parent);
    allNodes.add(child);
  }

  
  const acceptedChildren = new Set(childParentMap.keys());
  const roots = [];
  for (const node of allNodes) {
    if (!acceptedChildren.has(node)) roots.push(node);
  }

  const visited = new Set();
  const components = [];

  const undirected = new Map();
  for (const node of allNodes) undirected.set(node, new Set());
  for (const [parent, children] of adjacency) {
    for (const child of children) {
      undirected.get(parent).add(child);
      undirected.get(child).add(parent);
    }
  }

  function bfsComponent(start) {
    const comp = new Set();
    const queue = [start];
    while (queue.length) {
      const n = queue.shift();
      if (comp.has(n)) continue;
      comp.add(n);
      for (const nb of (undirected.get(n) || [])) {
        if (!comp.has(nb)) queue.push(nb);
      }
    }
    return comp;
  }

  for (const node of allNodes) {
    if (!visited.has(node)) {
      const comp = bfsComponent(node);
      for (const n of comp) visited.add(n);
      components.push(comp);
    }
  }

 
  function hasCycle(compNodes) {
    // DFS cycle detection on directed graph
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map();
    for (const n of compNodes) color.set(n, WHITE);

    function dfs(u) {
      color.set(u, GRAY);
      for (const v of (adjacency.get(u) || [])) {
        if (!compNodes.has(v)) continue;
        if (color.get(v) === GRAY) return true;
        if (color.get(v) === WHITE && dfs(v)) return true;
      }
      color.set(u, BLACK);
      return false;
    }

    for (const n of compNodes) {
      if (color.get(n) === WHITE) {
        if (dfs(n)) return true;
      }
    }
    return false;
  }

  function buildTree(node, compNodes) {
    const children = (adjacency.get(node) || []).filter(c => compNodes.has(c));
    const obj = {};
    for (const child of children) {
      obj[child] = buildTree(child, compNodes);
    }
    return obj;
  }

  function calcDepth(node, compNodes) {
    const children = (adjacency.get(node) || []).filter(c => compNodes.has(c));
    if (!children.length) return 1;
    return 1 + Math.max(...children.map(c => calcDepth(c, compNodes)));
  }

  const hierarchies = [];

  for (const comp of components) {
    const compRoots = [...comp].filter(n => roots.includes(n)).sort();

    const cyclic = hasCycle(comp);

    if (cyclic) {
     
      const cycleRoot = [...comp].sort()[0];
      hierarchies.push({ root: cycleRoot, tree: {}, has_cycle: true });
    } else {
      
      const rootsInComp = compRoots.length ? compRoots : [[...comp].sort()[0]];
      for (const r of rootsInComp) {
        const tree = {};
        tree[r] = buildTree(r, comp);
        const depth = calcDepth(r, comp);
        hierarchies.push({ root: r, tree, depth });
      }
    }
  }

  return hierarchies;
}

app.post("/bfhl", (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "data must be an array of strings" });
    }

    const { validEdges, invalid_entries, duplicate_edges } = parseData(data);
    const hierarchies = buildHierarchies(validEdges);

    const trees = hierarchies.filter(h => !h.has_cycle);
    const cycles = hierarchies.filter(h => h.has_cycle);

    let largest_tree_root = "";
    if (trees.length) {
      trees.sort((a, b) => {
        if (b.depth !== a.depth) return b.depth - a.depth;
        return a.root < b.root ? -1 : 1;
      });
      largest_tree_root = trees[0].root;
    }

    const summary = {
      total_trees: trees.length,
      total_cycles: cycles.length,
      largest_tree_root,
    };

    return res.json({
      user_id: USER_ID,
      email_id: EMAIL_ID,
      college_roll_number: ROLL_NUMBER,
      hierarchies,
      invalid_entries,
      duplicate_edges,
      summary,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BFHL API running on port ${PORT}`));
