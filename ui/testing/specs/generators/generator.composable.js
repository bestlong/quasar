import { readAstJson, getImportStatement } from '../astParser.js'
import { testIndent } from '../specs.utils.js'

const identifiers = {
  variables: {
    categoryId: '[Variables]',
    getTestId: name => `[(variable)${ name }]`,
    createTestFn: createVariableTest
  },

  classes: {
    categoryId: '[Classes]',
    getTestId: name => `[(class)${ name }]`,
    createTestFn: createClassTest
  },

  functions: {
    categoryId: '[Functions]',
    getTestId: name => `[(function)${ name }]`,
    createTestFn: createFunctionTest
  }
}

const varFilterRE = /(Props|Emits)$/
const useRE = /use[A-Z]/
const withComponentHostRE = /import \{.+(on[A-Za-z]+|getCurrentInstance).+\} from 'vue'/

function createVariableTest ({ testId, jsonEntry }) {
  return `
    describe('${ testId }', () => {
      test.todo('is defined correctly', () => {
        expect(${ jsonEntry.accessor }).toBeTypeOf('object')
        expect(Object.keys(${ jsonEntry.accessor })).not.toHaveLength(0)
      })
    })\n`
}

function createClassTest ({ testId, jsonEntry }) {
  return `
    describe('${ testId }', () => {
      test.todo('can be instantiated', () => {
        const instance = new ${ jsonEntry.accessor }(${ jsonEntry.constructorParams })

        // TODO: do something with "instance"
        expect(instance).toBeDefined() // this is here for linting only
      })
    })\n`
}

function getFnTests (jsonEntry, json) {
  /**
   * Update getFileHeader if you change the following "if"
   */
  if (
    // we need a host component for the composables
    json.componentHost === true
    // and this is a composable function
    && useRE.test(jsonEntry.accessor)
  ) {
    const lint = jsonEntry.params
      ? `// eslint-disable-next-line\n${ testIndent }    `
      : ''

    return `test.todo('can be used in a Vue Component', () => {
        const wrapper = mount(
          defineComponent({
            template: '<div />',
            setup () {
              ${ lint }const result = ${ jsonEntry.accessor }(${ jsonEntry.params })
              return { result }
            }
          })
        )

        // TODO: test the outcome
        expect(wrapper).toBeDefined() // this is here for lint only
      })`
  }

  const lint = jsonEntry.params
    ? `// eslint-disable-next-line\n${ testIndent }`
    : ''

  return `test.todo('has correct return value', () => {
        ${ lint }const result = ${ jsonEntry.accessor }(${ jsonEntry.params })
        expect(result).toBeDefined()
      })`
}

function createFunctionTest ({ testId, jsonEntry, json }) {
  return `
    describe('${ testId }', () => {
      ${ getFnTests(jsonEntry, json) }
    })\n`
}

export default {
  identifiers,
  getJson: ctx => {
    const json = readAstJson(ctx)

    json.variables = json.variables || {}

    // filter out component props and emits
    json.namedExports.forEach(name => {
      if (varFilterRE.test(name) === true) {
        json.namedExports.delete(name)
        delete json.variables[ name ]
      }
    })

    if (Object.keys(json.variables).length === 0) {
      delete json.variables
    }

    json.componentHost = withComponentHostRE.test(ctx.targetContent)

    return json
  },
  getFileHeader: ({ ctx, json }) => {
    /**
     * Update getFnTest if you change the following:
     */
    const needsMount = (
      json.componentHost === true
      && json.functions !== void 0
      && Object.keys(json.functions).some(
        key => useRE.test(json.functions[ key ].accessor)
      )
    )

    const acc = [
      'import { describe, test, expect } from \'vitest\''
    ]

    if (needsMount === true) {
      acc.push(
        'import { mount } from \'@vue/test-utils\'',
        'import { defineComponent } from \'vue\''
      )
    }

    acc.push(
      '',
      getImportStatement({ ctx, json })
    )

    return acc.join('\n')
  }
}
