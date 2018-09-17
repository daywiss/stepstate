const assert = require('assert')

module.exports = (handlers) => {
  assert(handlers,'Requires handlers object')
  if(handlers.catch == null) handlers.catch = e => { throw e}

  function archive(state){
    if(state.history == null) state.history = []
    state.history.unshift({
      state:state.state,
      updated:state.updated,
    })
    return state
  }

  async function step(state,...args){
    assert(state,'Handling state requires a state object')
    if(state.done) return state
    assert(handlers[state.state],'Invalid state trasition: ' + state.state)
    let transition 
    try {
      state = archive(state)
      state.updated = Date.now()
      transition =  await handlers[state.state](state,...args)
    }catch(e){
      transition = await handlers.catch(e,state,...args)
    }
    if(transition === state) return state

    if(transition){
      assert(typeof transition === 'string','State handlers must return either a string state transition or nothing')
      state.state = transition
    }
    return state
  }

  return step

}
module.exports.State = function (state={}){
    return {
      state:'Start',
      done:false,
      history:[],
      updated:Date.now(),
      ...state
    }
  }

