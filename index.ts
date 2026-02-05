type ChangeHandler<T, C extends object[]> = (captures: C, next: T, current: T, context: ChangeContext) => void;

type Subscriber<T> = {
    handler: ChangeHandler<T, any>;
    refs: WeakRef<object>[];
    state: State<T>;
    context: ChangeContext;
};

type ChangeContext = Subscriber<any>[];

class State<T> {
    static cleanups: WeakMap<WeakKey, Function[]> = new WeakMap;
    static registry: FinalizationRegistry<Function[]> = new FinalizationRegistry(
        (cleanups) => cleanups.forEach((cleanup) => cleanup())
    );
    _value: T;
    _subs: Subscriber<T>[];

    constructor(value: T) {
        this._value = value;
        this._subs = [];
    }

    get value(): T {
        return this._value;
    }

    set value(value: T) {
        for (const sub of this._subs) {
            const captures = new Array<object>(sub.refs.length);

            let dropped = false;
            for (let i = 0; i < captures.length; i++) {
                const capture: object | undefined = sub.refs[i].deref();

                if (capture === undefined) {
                    dropped = true;
                    break;
                }

                captures[i] = capture;
            }

            if (dropped) {
                this.unSubscribe(sub);
                continue;
            }

            try {
                State.clearChangeContext(sub.context);
                sub.handler(captures, value, this._value, sub.context);
            } catch {
                //
            }
        }

        this._value = value;
    }

    onChangeWeak<const C extends object[]>(handler: ChangeHandler<T, C>, captures: C, context: ChangeContext): void {
        const refs: WeakRef<object>[] = new Array(captures.length);

        for (let i = 0; i < captures.length; i++) {
            const capture = captures[i];

            refs[i] = new WeakRef(capture);

            const cleanups = State.cleanups.get(capture) ?? [];
            cleanups.push(() => this.unSubscribe(sub));

            State.cleanups.set(capture, cleanups);
            State.registry.register(capture, cleanups);
        }

        const sub: Subscriber<T> = {
            refs,
            handler,
            state: this,
            context: [],
        };

        context.push(sub);

        this._subs.push(sub);
    }

    unSubscribe(sub: Subscriber<T>): void {
        State.remove(this._subs, sub);
        State.clearChangeContext(sub.context);
    }

    static clearChangeContext(context: ChangeContext): void {
        for (const sub of context) {
            sub.state.unSubscribe(sub);
        }
    }

    static remove<T>(arr: T[], exclude: T): void {
        let length = 0;
        for (let i = 0; i < arr.length; i++) {
            const sub = arr[i];

            if (sub !== exclude) {
                if (i > length) {
                    arr[length] = sub;
                }
                length++;
            }
        }

        if (arr.length !== length) {
            arr.length = length;
        }
    }
}

/*








*/

const color = new State("red");

const background = new State("blue");

function Example(context: ChangeContext) {
    const div = document.createElement("div");

    div.style.color = color.value;

    color.onChangeWeak(([div], value, prev, context) => {
        div.style.color = value;
        Nested(context);
        AsyncNested(context);
    }, [div], context);

    return (
        div
    );
}

function Nested(context: ChangeContext) {
    // how do we track this?
    background.onChangeWeak(([], next, prev) => {
        next;
        prev;
    }, [], context);

    return (
        0
    );
}

async function AsyncNested(context: ChangeContext) {
    await Promise.resolve();

    // how the hell do we track this?
    background.onChangeWeak(([], next, prev) => {
        next;
        prev;
    }, [], context);

    return (
        0
    );
}
