const test = require('tape')
const Steps = require('.')

const steps = {
  Start:async data =>{
    return 'Middle'
  },
  Middle: async data => {
    return 'Error'
  },
  Error: async data => {
    throw new Error('error')
  },
  End: async data => {
    data.done = true
  },
  catch:async (e,data)=>{
    return 'End'
  }
}


test('Steps',t=>{
  let step 
  t.test('init',t=>{
    step = Steps(steps)
    t.ok(step)
    t.end()
  })
  t.test('run',async t=>{
    let state = Steps.State()
    while(!state.done){
      state = await step(state)
      console.log(state)
    }
    t.equal(state.state,'End')
    t.ok(state.done)
    t.end()
  })
})
