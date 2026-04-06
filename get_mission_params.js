import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const missionsPath = path.join(__dirname, 'src', 'missions', 'missions.js')

// Hardcoded arrays of every possible value the UI natively allows:
const UI_OPTIONS = {
    lr: [0.0001, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0],
    epochs: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100],
    dropout: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7],
    batchSize: [1, 8, 32, 128, 512],
    optimizer: ['sgd', 'momentum', 'rmsprop', 'adam'],
    activation: ['sigmoid', 'tanh', 'relu', 'leaky', 'elu'],
    layers: [2, 3, 4, 5, 6, 7, 8],
    width: [16, 64, 128, 256],
    init: ['zeros', 'random', 'xavier', 'he'],
    scheduler: ['none', 'step', 'cosine', 'plateau'],
    regularization: ['none', 'l1', 'l2', 'both'],
    filterSize: [1, 3, 5, 7],
    numFilters: [16, 32, 64, 128, 256],
    pooling: ['none', 'max', 'avg', 'global'],
    poolingPlacement: ['every', 'every2', 'end'],
    batchNorm: ['none', 'before', 'after'],
    skipConnections: ['none', 'every2', 'every3'],
    convLayers: [2, 4, 6, 8, 10, 12],
    augmentation: ['flip', 'crop', 'jitter', 'rotation', 'blur', 'cutout'] // Multiselect array
}

async function run() {
    // Read missions.js as text to bypass ES MJS loading complexities inside CJS scripts
    const code = fs.readFileSync(missionsPath, 'utf-8')

    // Nasty but functional regex to extract lockedParams blocks for each mission
    let output = '# LossLab Configurable Options Per Mission\n\n'

    const missionRegex = /id:\s*'([\w]+)',[\s\S]*?lockedParams:\s*\[([\s\S]*?)\]/g;
    let match;

    let missionNum = 1;
    while ((match = missionRegex.exec(code)) !== null) {
        const id = match[1]
        const lockedStr = match[2]

        // Parse the locks:
        const lockedKeys = [...lockedStr.matchAll(/'([\w]+)'/g)].map(m => m[1])

        output += `## Mission ${missionNum}: ${id}\n`
        output += `*The following parameters are UNLOCKED for this mission:*\n\n`

        let hasUnlocked = false;
        for (const [key, options] of Object.entries(UI_OPTIONS)) {
            if (!lockedKeys.includes(key)) {
                hasUnlocked = true;
                output += `- **${key}**: [ ${options.join(', ')} ]\n`
            }
        }

        if (!hasUnlocked) {
            output += `*None (Free Run or Cinematic mode)*\n`
        }
        output += '\n'
        missionNum++;
    }

    console.log(output)
    fs.writeFileSync('mission_param_breakdown.md', output, 'utf-8')
    console.log('Saved to mission_param_breakdown.md')
}

run()
