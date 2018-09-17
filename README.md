# StepState (Finite State Machine Framework)
A convention for defining stateful attributes and a small functional framework
for stepping stateful objects through a finite state machine which you define.


## Install
`npm install --save stepstate`

## Include
`const Steps= require('stepstate')`

## Philosophy of Use
A finite state machine is a good way to define complex data transitions. 
This framework allows you to use a regular object and provides a concise way to 
define your (async) state handlers.  Once defined, the state transition is accomplished
through a single async function which takes in the current state and returns the new state.
Each step checks the "state" attribute on your data, to know which state it is currently in.
Each transition to a new state is recorded in the "history" array.  Call step
iteratively until your state reaches its terminating point which can be read as the 
"done" data attribute. Outside of the "state", "done", "history" attributes, you can
include any other custom data you need for your transitions.

## Stateful Object Schema
As long as your objects conform to the following interface, they can be transitioned
in the state machine handlers. We propose a very minimal data structure which
also can store past state transition. 

```js
  // State Schema
  {
    state:string //Name of state, destination in state machine
    history:array[{state,updated}] //History of past states, most recent first
    done:boolean //If state has terminated, done=true otherwise done=false
    updated: unix timestamp in ms //Last time state was touched
  }

  //State History Schema
  {
    state:string
    updated:unix timestamp in ms
  }
```

## State Machine Handlers
State machine step handlers require user defined functions to describe how state is handled at each state,
transitioned and ended.  Transitions are returned as a string. If nothing is returned, the state will not change.
State termination is signified but setting "done=true" on the stateful object. Once done, the object will no 
longer be sent through the state machine.  Handlers can be async promises. Muating object can cause side effects, 
its recommended you clone it before passing in. 

```js
  const Steps = require('stepstate')

  //you can return the next state
  //or set obj.state = 'NextState'
  //and return object
  const steps = {
    Start:obj=>{
      return 'Next'
    },
    Next:obj=>{
      return 'Finalize'
    },
    Finalize:obj=>{
      return 'Done'
    },
    Done:obj=>{
      obj.done = true
      return 'Success'
    }
  }

  const step = Steps(steps)

  async function run(myObject){
    //myObject now has state=='Next'
    //its history will show it was in state 'Start'
    myObject = await step(myObject)

    //myObject now has state=='Finalize'
    //its history will show it was in state 'Start' and 'Next'
    myObject = await step(myObject)

    //myObject now has state=='Done'
    //its history will show it was in state 'Start' and 'Next' and 'Finalize'
    myObject = await step(myObject)

    //myObject now has state=='Success' and done == true
    //this object has reached terminating state
    myObject = await step(myObject)

    return myObject
  }

  let myObject = {state:'Start'}

  run(myObject).then(finalObject=>{
    //done
  })
  
```

## Error Handler
Any errors thrown in handlers can be intercepted and processed on a central error callback. If no error handler
is given, errors will be thrown. Unknown state transitions will not be passed into your error
handler but thrown and must be caught outside the call to handle.

```js

const steps = {
  //...other state handlers
  //catch is a reserved word used for catching errors thrown in handlers
  catch:(err,object)=>{
    //handle errors here, log them, maybe set the state of the object
    console.log('Error in statemachine',err)
    object.state = 'Error'
    object.error = err
    object.done = true
  }
}

const step = Steps(steps)

```

## Creating a Stateful object
Small utility function for attaching stateful properties to any object.
If no object is provided it will just return a bare starting state object.
By default the starting state is "Start", but you can specify your own
starting state in the object.

```js
  const transaction = Steps.State({
    id:'tx1',
    amount:1,
    to:'user1',
    from:'user2',
  })

  console.log(transaction)
  //{
  //  id:'tx1',
  //  amount:1,
  //  to:'user1',
  //  from:'user2',
  //  state:'Start',
  //  done:false,
  //  history:[],
  //  updated:12343234,
  //}
```

## Providing Context to your States 
You may need to access other types of state within your handlers. This is an example
of how to provide that within this framework. 

```js

  const Context = {
    multiplier:100,
    wallets: {...}//Assume some kind of wallets interface
  }

  function steps(context){
    return {
      Start: tx =>{
        const {wallets, multiplier} = context
        tx.amount *= multiplier
        //not enough funds
        if(!wallet.hasAmount(tx.from,tx.amount)){
          tx.state = 'Not Enough Funds'
          tx.done = true
          return tx
        }
        tx.state = 'Transact'
        return tx
      },
      Transact: tx =>{
        const {wallets} = context

        //continue transaction
        wallet.deduct(tx.from,tx.amount)
        wallet.add(tx.to,tx.amount)
        tx.done = true
        tx.state = 'Success'
        return tx
      },
    }
  }

  const step = Steps(steps(Context))

```

## API
Defines how to use the Steps API.

### Initialization
Create an instance of your "step" function with your states.

```js
const Steps= require('stepstate')
const step = Steps(stateHandlers)
```


**function(object:stateHandlers) => async function(object:statefulObject, ...arguments)**

* stateHandlers:object - an object containing keys of state names and functions for values. See [State Handlers](#state-handlers)

```js
  const Steps = require('stepstate')

  const steps = {
    'Start': x=> {
      return 'Middle'
    },
    'Middle': x=>{
      return 'End'
    },
    'End': x=>{
      x.done = true
    }
  }

  const step = Steps(steps)
```

### State Handlers
You must create state handlers to pass into the Steps framework. These handlers have a specific interface they must conform to
in order for them to be compatible with the framework. Handlers can return string, nothing or the data object, 

State handler object follow this pattern:

**object['string'] = async function(data, ...arguments)**

Each function has these parameters

**async function (object,...arguments) => string | undefined**

* data : stateful object - Your stateful data object. You should mutate this as needed, and set done=true when the data no longer needs to run in state machine.
* ...arguments : any - any arguments you passed in along with your data when calling [step](#step)
* return => Return nothing, a string representing the state name to transition to, or the original data object.


```js
const handlers = {
  'Start':async function(data, ...arguments)...,
  'Middle': async function(data, ...arguments)...,
  'End':async function(data, ...arguments)...,
}

```

### State Handler Errors
If any state handler has an uncaught error, you can intercept it with the `catch` state. This is a reserved
word within this framework, so your object states should not use `catch`. If no catch state is supplied
error will be thrown.

**function (error, object, ...arguments) => string | undefined**

* error: Error object - This is the error which was thrown
* object: Stateful object - This is the object state which caused the error
* ...arguments: any - Arguments passed into the step function
* return => Return nothing, a string to transition to a new state, or the original data object.

### Step 
This is an async function. Once you have a step function instance,
call it with a stateful object as first parameter. Other 
arguments will be passed through to your state handlers.

**async function(object:statefulObject, ...arguments) => object:statefulObject**

Call the step function with these parameters
* data: stateful object - Your stateful data object which you want to transition to the next step.
* ...arguments - any arguments you want to inject into the state function

```js
  let statefulObject = {
    state:'Start',
  }

  const step = ... //see Initialization

  async function run(){

     //when done == true your object is done being processed by this state machine
    while(!statefulObject.done){
      //calling step with stateful object and some random data which is passed through
      statefulObject = await step(statefulObject,Date.now(),'test')
    }
  }

  run()

```

### Creating Default Stateful Object
This library has a helper function to create a default state compatible with the Step framework.

**Steps.State(data) => stateful object**
* data:object - a non stateful object
* returns:stateful object =>  which will be returned with merged stateful data.

### Stateful Object Schema
A stateful object is just a regular js object with some extra properties: `state`, `history`, `done`, `updated`

**Object**

```js
{
  state:string,
  history:array[{state,updated}],
  done:boolean,
  updated:Unix Timestamp,
}
```



