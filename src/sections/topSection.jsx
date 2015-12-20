"use strict";

var React = require('react');

class TopSection extends React.Component {
    render() {
        return (
            <section id="top" className="one dark cover">
                <div className="container">

                    <header>
                        <h2 className="alt">Hi! I'm <strong>Prologue</strong>, a <a href="http://html5up.net/license">free</a>
                            responsive<br />
                            site template designed by <a href="http://html5up.net">HTML5 UP</a>.</h2>
                        <p>Ligula scelerisque justo sem accumsan diam quis<br />
                            vitae natoque dictum sollicitudin elementum.</p>
                    </header>

                    <footer>
                        <a href="#portfolio" className="button scrolly">Magna Aliquam</a>
                    </footer>

                </div>
            </section>
        )
    }
}

module.exports = TopSection;
