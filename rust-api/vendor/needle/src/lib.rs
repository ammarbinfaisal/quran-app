
#![cfg_attr(test, feature(test))]
#[cfg(test)]
extern crate test;

pub mod boyer_moore;
#[cfg(test)]
mod benchmarks;
mod skip_search;
mod horspool;

pub use boyer_moore::BoyerMoore;
pub use horspool::Horspool;
