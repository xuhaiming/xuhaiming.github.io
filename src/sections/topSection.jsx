"use strict";

var React = require('react');

class TopSection extends React.Component {
    render() {
        return (
            <section id="top" className="one dark cover">
                <div className="container">
                    <header>
                        <h2 className="alt">Welcome to my tech blog website!</h2>
                        <p>This website mainly shares my software development experiences which are related to <br /> web,
                        mobile, backend development, etc. Just click the button below and start your journey!</p>
                    </header>

                    <footer>
                        <a href="#blogs" className="button scrolly">Go to Blogs</a>
                    </footer>
                </div>
            </section>
        )
    }
}

module.exports = TopSection;
