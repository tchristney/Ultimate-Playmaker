/*
   Ultimate Playmaker

   A Javascript library for showing animated set plays in ultimate.

   Copyright (C) 2010 Tony Christney
   All rights reserved.

   Redistribution and use in source and binary forms, with or without 
   modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright notice, this 
	  list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright notice, this 
	  list of conditions and the following disclaimer in the documentation and/or 
	  other materials provided with the distribution.
    * Neither the name of Tony Christney nor the names of contributors to this software 
	  may be used to endorse or promote products derived from this software without 
	  specific prior written permission.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND 
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED 
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. 
	IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, 
	INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT 
	NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR 
	PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, 
	WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) 
	ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY 
	OF SUCH DAMAGE.
 */

if ( window.net === undefined ) {
	window.net = {};
}
if ( net.christney === undefined ) {
	net.christney = {};
}

net.christney.playbook = function ()
{
	/*
	 * Constructor for a position on the field to be occupied 
	 * at a specific time.
	 */
	function Destination(x,y,t)
	{
		this.x = x;
		this.y = y;
		this.t = t;
	}

	/*
	 * Used to represent an action that occurs at a specified time.
	 */
	function TimedAction( t, action )
	{
		this.t = t;
		this.done = false;
		this.action = action;
	}

	/*
	 * A Path is a list of Destination objects that an actor is moving through.
	 */
	function Path()
	{
		this.destinationList = [new Destination(0,0,0)];
	}

	// Get the position corresponding to the current time step.
	Path.prototype.position = function( t )
	{
		var i, start, end, fraction;

		// empty list, set it to origin
		if ( this.destinationList.length == 0 ) {
			return [0,0];
		}
		// only one destination is a static player
		else if ( this.destinationList.length == 1 ) {
			return [this.destinationList[0].x,this.destinationList[0].y];
		}
		// otherwise the player moves
		else {
			/*
			 * find the relationship between the current time step
			 * and the path the player should take.
			 */
			for ( i = 0; i < this.destinationList.length; i++ ) {
				// if we are at the current time then just return the position
				if ( this.destinationList[i].t == t ) {
					return [this.destinationList[i].x,
						   this.destinationList[i].y];
				}
				// keep setting the start point for this leg
				else if ( this.destinationList[i].t < t ) {
					start = this.destinationList[i];
				}
				// once we have a time greater than the current, set the end
				else {
					end = this.destinationList[i];
					break;
				}
			}

			// return a position between the start and end.
			if ( end !== undefined ) {
				fraction = (t - start.t)/(end.t - start.t);
				return [fraction*(end.x - start.x) + start.x,
					   fraction*(end.y - start.y) + start.y];
			}
			// we've passed the last time, so the actor stopped
			else {
				return [start.x,start.y];
			}
		}
	};

	/*
	 * Get the next destination on the path, given a time.
	 */
	Path.prototype.destinationAfter = function(t)
	{
		var i, end, curr;
		for ( i = 0; i < this.destinationList.length; i++ ) {
			// if we are at the current time then just return the position
			curr = this.destinationList[i];
			if ( curr.t > t ) {
				end = curr;
				break;
			}
		}

		return (end === undefined) ? this.last() : end;
	};

	/*
	 * Add a new Destination to the path.
	 */
	Path.prototype.addDestination = function(d)
	{
		this.destinationList.push(d);
	};

	/*
	 * Return the last destination for the actor.
	 */
	Path.prototype.last = function()
	{
		return this.destinationList[this.destinationList.length - 1];
	};

	/*
	 * Returns true if the actor has reached their final destination.
	 */
	Path.prototype.isDone = function(t)
	{
		return (this.last().t < t);
	};

	/*
	 * Actor representing the frisbee.
	 */
	function Disc()
	{
		this.holder = null; //< The holder - null if being thrown or on the ground.
		this.target = null; //< The target - not null if the disc is being thrown to someone.
		this.path = new Path(); //< The path of the disc.
		this.startPlayer = null; //< The player who starts the sequence with the disc.
	}

	/*
	 * Give the disc to a player at a specified time.
	 */
	Disc.prototype.giveTo = function( p, t )
	{
		var pos = p.path.position(t);
		this.holder = p;
		this.target = null;
		this.path.destinationList[0].x = pos[0];
		this.path.destinationList[0].y = pos[1];
		this.path.destinationList[0].t = t;

		if ( t == 0 ) {
			this.startPlayer = p;
		}

		if ( this.path.destinationList.length > 1 ) {
			this.path.destinationList.splice(1,1);
		}
	};

	/*
	 * Throw the disc to a player at a specified time.
	 */
	Disc.prototype.throwTo = function( p, t )
	{
		var hpos, tpos;
		if ( this.holder == null ) {
			return;
		}
		hpos = this.holder.path.position(t);
		tpos = p.path.destinationAfter(t);
		this.path.destinationList[0].x = hpos[0];
		this.path.destinationList[0].y = hpos[1];
		this.path.destinationList[0].t = t;
		this.path.destinationList.push( tpos );

		this.holder = null;
		this.target = p;
	};

	/*
	 * Returns true if the disc has been thrown to another player.
	 */
	Disc.prototype.inFlight = function ()
	{
		return (this.target !== null );
	};

	/*
	 * A player in the game.
	 */
	function Player(id)
	{
		this.id = id;
		this.path = new Path();
	}

	/*
	 * Set the starting location of a player.
	 */
	Player.prototype.startAt = function (x,y)
	{
		this.path.destinationList[0].x = x;
		this.path.destinationList[0].y = y;
	};

	/*
	 * Tell the player to wait before continuing on his path.
	 */
	Player.prototype.wait = function ( t_seconds )
	{
		var lastDest = this.path.last();
		this.path.addDestination( new Destination(lastDest.x,lastDest.y,lastDest.t + t_seconds ) );
	};

	/*
	 * Add a path element telling him to cut relative to his current position.
	 */
	Player.prototype.runAtSpeed = function (dx,dy,v)
	{
		var lastDest = this.path.last();
		var dist = Math.sqrt( dx*dx + dy*dy );
		var speed;

		if ( v === undefined ) {
			speed = 7;
		}
		else {
			speed = v;
		}

		this.path.addDestination(
				new Destination( lastDest.x + dx, lastDest.y + dy, lastDest.t + dist/speed ) );
	};

	/*
	 * Represents the 7 players on a team.
	 */
	function Team(id)
	{
		var i;
		this.players = [];
		for ( i = 0; i < 7; i++ ) {
			this.players[i] = new Player(i);
		}
		this.id = id;
	}

	/*
	 * Represents a game of ultimate.
	 */
	function Game( id )
	{
		this.isPaused = false;
		this.currentTime = 0;
		this.id = id;
		this.offence = new Team("offence");
		this.defence = new Team("defence");
		this.disc = new Disc();
		this.actions = [];
	}

	/*
	 * Give the disc to a player right now.
	 */
	Game.prototype.giveDisc = function(p)
	{
		this.disc.giveTo( p, this.currentTime );
	};

	/*
	 * Add a game action where the disc is thrown to a player.
	 */
	Game.prototype.throwDisc = function( t, p )
	{
		this.actions.push( new TimedAction( t,
					function(game)
					{
						game.disc.throwTo( p, t );
					}
					));
	};

	/*
	 * Execute any timed actions.
	 */
	Game.prototype.performActions = function()
	{
		var i, curr;

		for( i = 0; i < this.actions.length; i++ ) {
			curr = this.actions[i];
			if ( !curr.done && curr.t <= this.currentTime ) {
				curr.action(this);
				curr.done = true;
				continue;
			}
		}
	};

	/*
	 * Reset the game to its initial state.
	 */
	Game.prototype.reset = function()
	{
		var i;
		this.currentTime = 0;
		this.isPaused = false;
		this.giveDisc( this.disc.startPlayer );
		for ( i = 0; i < this.actions.length; i++ ) {
			this.actions[i].done = false;
		}
	};

	/*
	 * Pause the play.
	 */
	Game.prototype.pause = function()
	{
		this.isPaused = true;
	};

	/* Variables used to represent the field. */
	Game.prototype.showLines = true;
	Game.prototype.scaleFactor = 5;
	Game.prototype.margin = 2.5;
	Game.prototype.fieldWidth = 40*Game.prototype.scaleFactor;
	Game.prototype.endzoneDepth = 25*Game.prototype.scaleFactor;
	Game.prototype.playingFieldLength = 70*Game.prototype.scaleFactor;
	Game.prototype.fieldLength = 2*Game.prototype.endzoneDepth + 
							Game.prototype.playingFieldLength;
	Game.prototype.brickDepth = 20*Game.prototype.scaleFactor;

	/*
	 * Draw the ultimate field.
	 */
	Game.prototype.drawField = function( canvas, context )
	{
		canvas.width = this.fieldWidth + 2*this.margin;
		canvas.height = this.fieldLength + 2*this.margin;
		context.fillStyle = "green";
		context.fillRect(0,0,canvas.width,canvas.height);
		context.strokeStyle = "white";
		context.strokeRect(this.margin,this.margin,
				this.fieldWidth,this.fieldLength);
		context.strokeRect(this.margin,this.margin,
				this.fieldWidth, this.endzoneDepth );
		context.strokeRect(this.margin,
				this.margin + this.endzoneDepth + this.playingFieldLength,
				this.fieldWidth, this.endzoneDepth);
		context.strokeRect( this.fieldWidth/2,
				this.endzoneDepth + this.brickDepth, 1, 1 );
		context.strokeRect( this.fieldWidth/2,
				this.endzoneDepth + this.playingFieldLength - this.brickDepth,
				1, 1 );
	};

	/*
	 * Draw the game at the current time.
	 */
	Game.prototype.draw = function()
	{
		var game = this;
		var canvas;
		var context;
		var i,p,path,j;

		canvas = document.getElementById( game.id );
		context = canvas.getContext('2d');

		if ( context ) {
			game.drawField(canvas,context);

			// draw the offence
			for ( i = 0; i < game.offence.players.length; i++ ) {
				p = game.offence.players[i].path.position(game.currentTime);

				if ( game.showLines ) {
					context.strokeStyle = "white";
					context.beginPath();
					path = game.offence.players[i].path.destinationList;
					for ( j = 0; j < path.length && path[j].t < game.currentTime; j++ ) {
						if ( j == 0 ) {
							context.moveTo( game.scaleFactor*path[j].x, game.scaleFactor*path[j].y );
						}
						else {
							context.lineTo( game.scaleFactor*path[j].x, game.scaleFactor*path[j].y );
						}
					}
					context.lineTo( game.scaleFactor*p[0], game.scaleFactor*p[1] );
					context.stroke();
				}

				context.strokeStyle = "black";
				context.fillStyle = "red";
				context.beginPath();
				context.arc( game.scaleFactor*p[0], game.scaleFactor*p[1],
						game.scaleFactor*0.5, 0, 2*Math.PI, true );
				context.closePath();
				context.fill();
				context.stroke();
			}

			// draw the disc
			context.strokeStyle = "white";
			context.fillStyle = "white";
			p = game.disc.path.position(game.currentTime);
			context.beginPath();
			context.arc( game.scaleFactor*(p[0]+0.5), game.scaleFactor*(p[1]-0.5),
					game.scaleFactor*0.5, 0, 2*Math.PI, true );
			context.closePath();
			context.fill();
			context.stroke();

			if ( game.disc.path.isDone(game.currentTime) && game.disc.inFlight() ) {
				game.giveDisc( game.disc.target );
			}
		}
	};

	/*
	 * Returns true if all the actors have finished moving.
	 */
	Game.prototype.isDone = function()
	{
		var i,p;
		for ( i = 0; i < this.offence.players.length; i++ ) {
			p = this.offence.players[i];
			if ( ! p.path.isDone( this.currentTime ) ) {
				return false;
			}
		}
		return true;
	};

	var timer;
	var timeStep = 20;
	var activeGames = [];

	/*
	 * Animation loop. Private.
	 */
	var animate = function () {
		var i, doneGames = [];

		/* animate each running game. */
		for ( i = 0; i < activeGames.length; i++ ) {
			if ( ! activeGames[i].isPaused ) {
				activeGames[i].currentTime += timeStep/1000;
			}
			activeGames[i].performActions();
			activeGames[i].draw();

			/* 
			 * if this game is done, flag it for removal.
			 * Removing it here will bugger up our loop.
			 */
			if ( activeGames[i].isDone() ) {
				doneGames.push( activeGames[i] );
			}
		}

		/* remove dead games from the list. */
		while ( doneGames.length > 0 ) {
			net.christney.playbook.Animator.stopGame( doneGames.pop() );
		}
	}

	/* 
	 * Animator is just an empty object without state - sort of a Factory object.
	 */
	function Animator()
	{
	}

	/*
	 * Start running a game.
	 */
	Animator.prototype.startGame = function ( gObj )
	{
		var i;
		if ( !gObj )
		{
			return;
		}

		gObj.isPaused = false;

		for ( i = 0; i < activeGames.length; i++ )
		{
			if ( activeGames[i] === gObj ) {
				return;
			}
		}
		activeGames.push( gObj );

		/* If the timer isn't running, start it up. */
		if ( activeGames.length > 0 && timer === undefined ) {
			timer = setInterval( animate, timeStep );
		}
	};

	/*
	 * Stop running a game.
	 */
	Animator.prototype.stopGame = function ( gObj )
	{
		var i;
		if ( !gObj )
		{
			return gObj;
		}

		for ( i = 0; i < activeGames.length; i++ )
		{
			if ( activeGames[i] === gObj ) {
				gObj = activeGames.splice( i, 1 );
				break;
			}
		}

		/* Kill the timer if no more animations are running. */
		if ( timer !== undefined && activeGames.length == 0 ) {
			clearInterval( timer );
			timer = undefined;
		}
		return gObj;
	};

	return (
	{
		Player: Player,
		Team: Team,
		Game: Game,
		Animator: new Animator()
	});

 }();
