import * as core from '@actions/core'
import * as glob from '@actions/glob'
import {TestExecution} from './api/types'
import {ZephyrScaleApi} from './api'
import {collectExecutions} from './utils'

async function run(): Promise<void> {
  try {
    const jiraBaseUrl = core.getInput('jiraBaseUrl', {required: true})
    const projectKey = core.getInput('projectKey', {required: true})
    const bearerToken = core.getInput('bearerToken', {required: true})
    const reportPaths = core.getInput('zephyrScaleReportPaths', {
      required: true
    })
    const testCycleKey = core.getInput('testCycleKey', {required: true})

    const globber = await glob.create(reportPaths)
    const files = await globber.glob()

    const api = new ZephyrScaleApi(jiraBaseUrl, '1.0', projectKey, bearerToken)

    const testCycle = await api.getTestCycle(testCycleKey)
    if (testCycle.items !== undefined) {
      const testCasesInTestCycle = new Set(
        testCycle.items.map(item => item.testCaseKey)
      )
      const executions = await collectExecutions(files)
      const executionsToUpload = executions.filter(execution =>
        testCasesInTestCycle.has(execution.testCase.key)
      )
      const testResultsToUpload = executionsToUpload.map(execution => {
        const status = execution.result === 'Passed' ? 'Pass' : 'Fail'
        const testResult: TestExecution = {
          projectKey,
          testCaseKey: execution.testCase.key,
          status
        }
        return testResult
      })
      await api.postTestExecutionsForTestCycle(
        testCycleKey,
        testResultsToUpload
      )
    } else {
      core.info('There are no Test Cases in specified Test Cycle')
    }
  } catch (error) {
    let errorMessage = 'Unknown error'
    if (error instanceof Error) errorMessage = error.message

    core.setFailed(errorMessage)
  }
}

run()
